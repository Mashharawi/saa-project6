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