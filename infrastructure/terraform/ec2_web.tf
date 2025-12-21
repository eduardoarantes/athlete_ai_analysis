# Cycling AI Analysis - EC2 Configuration for Next.js Docker
# Runs Next.js application in Docker container on EC2

# ECR Repository for Next.js Docker image
resource "aws_ecr_repository" "web" {
  name                 = "${local.name_prefix}-web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${local.name_prefix}-web-ecr"
  }
}

# ECR Lifecycle policy to keep only recent images
resource "aws_ecr_lifecycle_policy" "web" {
  repository = aws_ecr_repository.web.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# IAM Role for EC2 instance
resource "aws_iam_role" "ec2_web" {
  name = "${local.name_prefix}-ec2-web-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ec2-web-role"
  }
}

# IAM Instance Profile for EC2
resource "aws_iam_instance_profile" "ec2_web" {
  name = "${local.name_prefix}-ec2-web-profile"
  role = aws_iam_role.ec2_web.name
}

# Attach SSM managed policy for remote command execution
resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_web.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# IAM Policy for EC2 - ECR pull, Lambda invoke, CloudWatch logs
resource "aws_iam_role_policy" "ec2_web" {
  name = "${local.name_prefix}-ec2-web-policy"
  role = aws_iam_role.ec2_web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR authentication and pull
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = aws_ecr_repository.web.arn
      },
      # Lambda invocation (for calling Python API)
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.api.arn
      },
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/ec2/${local.name_prefix}-*"
      },
      # SSM Parameter Store (read secrets)
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.name_prefix}/*"
      },
      # KMS decrypt for SecureString parameters
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# Security Group for EC2 instance
resource "aws_security_group" "ec2_web" {
  name        = "${local.name_prefix}-ec2-web-sg"
  description = "Security group for Next.js EC2 instance"

  # HTTP from anywhere (CloudFront doesn't have fixed IPs)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from CloudFront"
  }

  # HTTPS from anywhere
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from CloudFront"
  }

  # SSH for debugging (optional, can be restricted)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name = "${local.name_prefix}-ec2-web-sg"
  }
}

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 Instance for Next.js
resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.micro" # Free tier eligible
  iam_instance_profile   = aws_iam_instance_profile.ec2_web.name
  vpc_security_group_ids = [aws_security_group.ec2_web.id]

  # Enable detailed monitoring (optional)
  monitoring = false

  # Root volume
  root_block_device {
    volume_size           = 30 # GB - minimum for Amazon Linux 2023
    volume_type           = "gp3"
    delete_on_termination = true
  }

  # User data script to install Docker and start the container
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    # Update system
    dnf update -y

    # Install Docker and jq
    dnf install -y docker jq
    systemctl enable docker
    systemctl start docker

    # Add ec2-user to docker group
    usermod -aG docker ec2-user

    # Install AWS CLI (already included in AL2023)

    # Create startup script that fetches secrets from SSM
    cat > /usr/local/bin/start-nextjs.sh << 'SCRIPT'
    #!/bin/bash
    set -e

    # Variables
    AWS_REGION="${var.aws_region}"
    ECR_REGISTRY="${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    IMAGE_NAME="${local.name_prefix}-web"
    SSM_PREFIX="/${local.name_prefix}"

    # Function to get SSM parameter
    get_ssm_param() {
      aws ssm get-parameter --name "$1" --with-decryption --region $AWS_REGION --query 'Parameter.Value' --output text 2>/dev/null || echo ""
    }

    # Fetch secrets from SSM Parameter Store
    echo "Fetching secrets from SSM Parameter Store..."
    SUPABASE_URL=$(get_ssm_param "$SSM_PREFIX/supabase/url")
    SUPABASE_ANON_KEY=$(get_ssm_param "$SSM_PREFIX/supabase/anon-key")
    SUPABASE_SERVICE_ROLE_KEY=$(get_ssm_param "$SSM_PREFIX/supabase/service-role-key")
    STRAVA_CLIENT_ID=$(get_ssm_param "$SSM_PREFIX/strava/client-id")
    STRAVA_CLIENT_SECRET=$(get_ssm_param "$SSM_PREFIX/strava/client-secret")
    APP_URL=$(get_ssm_param "$SSM_PREFIX/app/url")

    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

    # Pull latest image
    docker pull $ECR_REGISTRY/$IMAGE_NAME:latest || echo "Image not found, will retry on next run"

    # Stop existing container if running
    docker stop nextjs-app 2>/dev/null || true
    docker rm nextjs-app 2>/dev/null || true

    # Run container with environment variables from SSM
    docker run -d \
      --name nextjs-app \
      --restart unless-stopped \
      -p 80:3000 \
      -e NODE_ENV=production \
      -e AWS_REGION=$AWS_REGION \
      -e LAMBDA_FUNCTION_NAME="${aws_lambda_function.api.function_name}" \
      -e NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
      -e NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
      -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
      -e STRAVA_CLIENT_ID="$STRAVA_CLIENT_ID" \
      -e STRAVA_CLIENT_SECRET="$STRAVA_CLIENT_SECRET" \
      -e NEXT_PUBLIC_APP_URL="$APP_URL" \
      $ECR_REGISTRY/$IMAGE_NAME:latest

    echo "Container started with secrets from SSM Parameter Store"
    SCRIPT

    chmod +x /usr/local/bin/start-nextjs.sh

    # Create systemd service for auto-start
    cat > /etc/systemd/system/nextjs.service << 'SERVICE'
    [Unit]
    Description=Next.js Docker Container
    After=docker.service
    Requires=docker.service

    [Service]
    Type=oneshot
    RemainAfterExit=yes
    ExecStart=/usr/local/bin/start-nextjs.sh
    ExecStop=/usr/bin/docker stop nextjs-app

    [Install]
    WantedBy=multi-user.target
    SERVICE

    systemctl daemon-reload
    systemctl enable nextjs.service

    # Try to start (will fail if no image yet, that's ok)
    /usr/local/bin/start-nextjs.sh || echo "Container not started - push image to ECR first"
  EOF
  )

  tags = {
    Name = "${local.name_prefix}-web"
  }

  lifecycle {
    # Prevent accidental termination
    prevent_destroy = false
  }
}

# Elastic IP for EC2 (optional but recommended for stable DNS)
resource "aws_eip" "web" {
  instance = aws_instance.web.id
  domain   = "vpc"

  tags = {
    Name = "${local.name_prefix}-web-eip"
  }
}

# CloudWatch Log Group for EC2
resource "aws_cloudwatch_log_group" "ec2_web" {
  name              = "/ec2/${local.name_prefix}-web"
  retention_in_days = local.config.log_retention

  tags = {
    Name = "${local.name_prefix}-web-ec2-logs"
  }
}
