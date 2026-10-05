# Architecture Notes

## Step 3: VPC and Networking

### Subnet Design (us-east-1)

| Subnet      |           | CIDR          |         AZ  |          Purpose
|-------------|-------------|---------------|------------------|
| subnet-0e20efc7fdae5107b |  10.0.0.0/20    |  us-east-1a |public  |ALB
|  subnet-0091d3a2bc4c1ca26 |  10.0.16.0/20   |  us-east-1b |public  |ALB
|  subnet-0fc94946c2d0cde9b |  10.0.128.0/20  |  us-east-1a |private1  |ECS, Redis
|  subnet-0641d6b811727e44a |  10.0.144.0/20  |  us-east-1b |private1  |ECS, Redis
VPC CIDR: 10.0.0.0/16

### Design Decisions
The VPC spans two Availability Zones so the application survives the loss
of one AZ. Only the Application Load Balancer sits in the public subnets;
all compute (ECS tasks) and data (ElastiCache) stay in private subnets
with no direct route to the internet, reached only via a NAT Gateway for
outbound traffic (e.g. pulling images from ECR, calling AWS APIs).

### Security Groups
- **alb-sg**: allows inbound HTTP (80) from the internet (0.0.0.0/0).
- **ecs-sg**: allows inbound TCP 3000 only from alb-sg — containers are
  unreachable except through the load balancer.

  ## Step 4: ECR

Three private repositories created with scan-on-push enabled:
- auth-service
- orders-service
- notifications-service

Images are tagged `latest` and pushed from local builds. ECR's vulnerability
scan runs automatically on every push.
## Step 5: IAM Roles and Secrets Manager

- project6-ecs-execution-role: AmazonECSTaskExecutionRolePolicy (pulls
  images from ECR, writes logs to CloudWatch — used by the ECS agent)
- project6-ecs-task-role: inline policy scoped to
  secretsmanager:GetSecretValue on project6/app-secrets only (used by
  application code inside the container)
- Secret project6/app-secrets stores JWT_SECRET and REDIS_HOST, injected
  into containers at runtime rather than hardcoded in the image
  ## Step 6: ElastiCache Redis

- Cluster: project6-redis, cache.t3.micro, cluster mode disabled, 0 replicas
- Deployed in private subnets only, reachable only from ecs-sg via redis-sg
- Used as a shared session store so any Auth task can validate sessions
  created by any other task
  

  ### Lesson learned: execution role vs task role for injected secrets
When ECS injects Secrets Manager values as container environment variables,
the ECS agent fetches them using the **execution role** before the container
starts — not the task role. Both roles needed secretsmanager:GetSecretValue
on project6/app-secrets.


### Lesson learned: execution role vs task role, and role mix-ups
Secrets injected as container environment variables are fetched by the
ECS agent using the **execution role**, not the task role — a common
source of confusion since this permission intuitively feels like an
application-level concern.

Additionally, orders-task and notifications-task were found to be using
a different, pre-existing role (ecsTaskExecutionRole) instead of the
project's own project6-ecs-execution-role, which had the policy. Fixed
by granting secretsmanager:GetSecretValue to ecsTaskExecutionRole as
well, via CLI (console save did not persist the inline policy on first
attempt — verified with `aws iam list-role-policies`).

Follow-up cleanup: unify all three task definitions to use
project6-ecs-execution-role for consistency.
Let's skip the console entirely and do it via CLI, which is faster
cd C:\Users\Mash\saa-project6
@'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:121312796739:secret:project6/app-secrets-*"
    }
  ]
}
'@ | Out-File -Encoding ascii secrets-policy.json
aws iam put-role-policy --role-name ecsTaskExecutionRole --policy-name read-app-secrets --policy-document file://secrets-policy.json
aws iam list-role-policies --role-name ecsTaskExecutionRole
aws ecs update-service --cluster project6-cluster --service orders-service --force-new-deployment --region us-east-1 | Out-Null
aws ecs update-service --cluster project6-cluster --aws ecs describe-services --cluster project6-cluster --services orders-service notifications-service --region us-east-1 --query "services[].{name:serviceName,running:runningCount,desired:desiredCount}"service notifications-service --force-new-deployment --region us-east-1 | Out-Null

## Step 8: ALB with Path-Based Routing

- project6-alb (internet-facing, public subnets, alb-sg)
- Listener HTTP:80 with 3 path-based rules + default action
- Each rule uses a URL rewrite transform to strip the /api/<service>
  prefix before forwarding, since the containers expose routes without
  that prefix (e.g. /health, not /api/auth/health)
- Target groups (auth-tg, orders-tg, notifications-tg) use IP target
  type for Fargate awsvpc networking, health check path /health
markdown
## الخطوة 8: ALB مع التوجيه حسب المسار

- project6-alb (مواجه للإنترنت، شبكات عامة، alb-sg)
- Listener HTTP:80 بثلاث قواعد حسب المسار + إجراء افتراضي
- كل قاعدة تستخدم transform لإعادة كتابة URL يُزيل بادئة /api/<service>
  قبل التوجيه، لأن الحاويات تعرض مسارات بدون هذه البادئة
- target groups تستخدم نوع هدف IP لشبكات Fargate awsvpc، مسار فحص
  الصحة /health
  ## Step 9: Cloud Map Service Discovery

- Private DNS namespace: project6.local, scoped to project6-vpc
- Each service registered with a 10s TTL A record:
  auth.project6.local, orders.project6.local,
  notifications.project6.local
- Enables server-to-server calls without going through the ALB,
  resilient to Fargate task IP changes on restart