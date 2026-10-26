# Arquitectura de LeGrandHotel

El usuario solo llega a CloudFront (sitio web) y al balanceador (API). La API corre en EC2;
la base de datos y Redis no tienen acceso desde internet. GitHub Actions despliega, CloudWatch
recibe los logs y S3 guarda los respaldos.

```mermaid
flowchart LR
  U[Usuario] -->|HTTPS| CF[CloudFront]
  CF --> S3W[(S3 privado<br/>React ofuscado)]
  U -->|HTTPS 443| ALB[Application Load Balancer]

  subgraph VPC["VPC 10.20.0.0/16 · us-east-1"]
    subgraph PUB["Subredes públicas (2 zonas)"]
      ALB
      ASG["Auto Scaling 1–3 × EC2 t3.small<br/>Nginx · PHP-FPM · worker · scheduler"]
    end
    subgraph PRIV["Subredes privadas (2 zonas)"]
      RDS[(RDS MySQL 8<br/>cifrada · snapshots 7 días)]
      REDIS[(ElastiCache Redis<br/>caché · rate limit · colas)]
    end
  end

  ALB -->|/api/v1/health| ASG
  ASG --> RDS
  ASG --> REDIS
  ASG --> SSM[SSM Parameter Store<br/>secretos]
  ASG -->|logs JSON| CW[CloudWatch Logs + alarmas]
  CW --> SNS[SNS → correo del equipo]
  ASG -->|mysqldump diario| S3B[(S3 respaldos<br/>versionado)]

  GH[GitHub Actions] -->|OIDC| ECR[(ECR imagen API)]
  GH -->|build ofuscado| S3W
  GH -->|instance refresh| ASG
```

## Security Groups

| Grupo | Entrada permitida |
| --- | --- |
| `alb` | 443 y 80 (80 solo redirige a HTTPS) desde internet |
| `app` (EC2) | 80 únicamente desde el SG del ALB |
| `db` (RDS) | 3306 únicamente desde el SG `app` |
| `redis` | 6379 únicamente desde el SG `app` |

## Monorepo

| Carpeta | Contenido |
| --- | --- |
| `api/` | Laravel 12 (PHP 8.2+/8.3 en Docker), Sanctum, Socialite, Pest, Laravel Boost |
| `web/` | React 18 + TypeScript + Vite, React Router, TanStack Query, Axios, Vitest |
| `infra/` | Terraform, Docker (Nginx, compose de producción), CloudWatch, scripts de respaldo |
| `tests/k6/` | Pruebas de carga, estrés, pico, resistencia y smoke |
| `docs/` | Diagramas, endpoints, pruebas, incidentes, seguridad, migración |
