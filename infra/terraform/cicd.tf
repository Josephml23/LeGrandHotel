# ── GitHub Actions despliega con un rol IAM vía OIDC (sin claves fijas en GitHub Secrets) ──
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_deploy" {
  name = "${local.name}-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        # El job de deploy.yml declara `environment: production`, y entonces GitHub firma el token con
        # sub = repo:<owner>/<repo>:environment:production (ya no lleva la rama). Con la condición anterior
        # (ref:refs/heads/main) AWS rechazaba el AssumeRole. Que solo main despliegue se asegura en GitHub:
        # Settings → Environments → production → Deployment branches: solo main.
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:environment:production"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "deploy"
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      {
        Effect = "Allow"
        Action = ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:DescribeImages"]
        Resource = aws_ecr_repository.api.arn
      },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = [aws_s3_bucket.web.arn, aws_s3_bucket.backups.arn] },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"], Resource = ["${aws_s3_bucket.web.arn}/*", "${aws_s3_bucket.backups.arn}/deploy/*"] },
      { Effect = "Allow", Action = ["cloudfront:CreateInvalidation"], Resource = aws_cloudfront_distribution.web.arn },
      {
        Effect   = "Allow"
        Action   = ["autoscaling:StartInstanceRefresh", "autoscaling:DescribeInstanceRefreshes", "autoscaling:CancelInstanceRefresh", "autoscaling:RollbackInstanceRefresh"]
        Resource = "*"
      },
      # GetParameter: el paso "Imagen actual (para rollback)" lee la imagen vigente; sin él siempre daba "none".
      { Effect = "Allow", Action = ["ssm:GetParameter", "ssm:PutParameter"], Resource ="arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/legrandhotel/${var.environment}/API_IMAGE" }
    ]
  })
}
