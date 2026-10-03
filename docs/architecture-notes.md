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
  