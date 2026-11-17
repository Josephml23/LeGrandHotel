# Guía para migrar LeGrandHotel de Render a AWS

Escrita para una persona que **nunca usó AWS**, en Windows (Git Bash o PowerShell). Cada paso dice dónde se hace,
el comando exacto, qué deberías ver, qué cuesta y cómo deshacerlo.

> **Estado de esta guía.** Nada de lo que describe se ha ejecutado: el Terraform de `infra/terraform` **nunca se ha
> aplicado** (no hay `tfstate` ni `terraform.tfvars`), y Terraform y AWS CLI no estaban instalados al escribirla.
> Los nombres de variables, outputs, recursos y comandos salen de los archivos reales del repositorio. Lo que no se
> pudo comprobar está marcado con **[No verificado]**. Si un paso no da lo que dice, para y revisa la sección
> «Si algo falla» antes de seguir.

## 0. Antes de empezar

### Qué vas a construir

```
Usuario ─▶ CloudFront ─▶ S3 privado (web React)          app.<tu-dominio>
Usuario / app Flutter ─▶ ALB :443 ─▶ EC2 (Docker) ─▶ RDS MySQL 8.4     api.<tu-dominio>
GitHub Actions ─(OIDC)─▶ ECR (imagen) · S3 (web) · instance refresh del ASG
```

Detalle y costos: `infra/README.md`. Estrategia general de cambio de servidor: `docs/migracion-servidor.md`.

### Lo que necesitas tener

| Cosa | Para qué | Costo |
| --- | --- | --- |
| Un **dominio** propio (p. ej. `legrandhotel.pe`) | El ALB necesita un certificado HTTPS y ACM solo emite certificados para dominios tuyos. Sin dominio no hay AWS (decisión del proyecto) | Depende del registrador; un `.com` suele costar entre 10 y 15 USD/año **[No verificado, confirma el precio]** |
| Una tarjeta para la cuenta de AWS | AWS la pide aunque uses solo lo gratuito | 0 (puede hacer un cargo de verificación pequeño que se devuelve **[No verificado]**) |
| Git, Docker Desktop, PHP (los de tu entorno de desarrollo) y el repositorio en `C:\Proyectos\LeGrandHotel` | Generar `APP_KEY`, exportar la base de Render | 0 |
| Cuenta de GitHub con permiso de administrador en `Josephml23/LeGrandHotel` | Crear el environment, secretos y variables | 0 |
| Acceso al panel de Render y a Google Cloud Console | Copiar datos, cambiar la URI de Google | 0 |

### Costo que debes esperar (tomado de `infra/README.md`)

- **Con la configuración de `terraform.tfvars.example`** (sin Redis ni NAT): unos **45 USD/mes** encendido 24/7
  (EC2 t3.small ~15, RDS db.t3.micro ~15, ALB ~17, IPv4 públicas 4–8, resto 1–3).
- Con Redis: 60–75 USD/mes. Con NAT Gateway: +32 USD/mes.
- La alerta de presupuesto es de **10 USD** (`budget_limit_usd`): saltará en el primer mes. Es lo esperado, no una avería.
- **Lo que cobra aunque no uses la web:** el ALB, el RDS, las IPv4 y la EC2 mientras existan. Para dejar de gastar
  hay que destruir (sección 13), no basta con «no entrar».

### Reglas que se aplican en toda la guía

- **Nunca uses la cuenta raíz** para trabajar (solo para crear el usuario IAM y activar MFA).
- **Región: `us-east-1` (N. Virginia).** Todo, incluido el certificado, va ahí.
- **No pegues contraseñas ni claves en el repositorio ni en el chat.** `terraform.tfvars`, `*.tfstate` y `.terraform/`
  ya están en `.gitignore`.
- **`terraform.tfstate` contiene la contraseña de la base de datos en claro.** Guárdalo solo en tu equipo (haz una
  copia fuera del repositorio). Si lo pierdes, Terraform ya no sabe qué creó y habrá que borrar a mano.
- **Git Bash en Windows convierte las rutas que empiezan con `/`** (`/legrandhotel/prod/...` se vuelve
  `C:/Program Files/Git/legrandhotel/...`). En Git Bash antepón `MSYS_NO_PATHCONV=1` a cada comando `aws` que lleve
  una ruta de SSM (los ejemplos ya lo traen). En PowerShell quita ese prefijo.
- Los comandos van en **una sola línea** para que funcionen igual en Git Bash y PowerShell. Cuando cambia la sintaxis
  se indican las dos versiones.
- Todos los comandos de `terraform` se ejecutan **desde la raíz del repositorio** con `-chdir=infra/terraform`.

---

## 1. Cuenta de AWS y usuario IAM

**Dónde:** navegador, https://aws.amazon.com → «Crear una cuenta de AWS».

1. Crea la cuenta con tu correo, elige el plan **Basic/Gratuito** de soporte y añade la tarjeta.
2. Entra como usuario raíz → arriba a la derecha, tu nombre → **Credenciales de seguridad** → **Activar MFA**
   (app autenticadora). Sin MFA en la raíz no sigas.
3. Todavía como raíz, activa que los usuarios IAM vean la facturación: **Cuenta → Acceso de usuarios y roles de IAM
   a la información de facturación → Activar**.
4. **IAM → Usuarios → Crear usuario** (p. ej. `terraform-legrandhotel`).
   - Permisos: **Adjuntar políticas directamente → `AdministratorAccess`**.
   - **Por qué tanto permiso:** Terraform crea roles IAM, un proveedor OIDC, VPC, RDS, ALB, CloudFront, etc.; una
     política «mínima» que cubra todo es larga y frágil. El riesgo se limita así: usuario que **no** es la raíz, con
     **MFA**, con claves que **borras al terminar** (sección 13).
   - Activa MFA también en este usuario.
5. En el usuario → **Credenciales de seguridad → Crear clave de acceso → Interfaz de línea de comandos (CLI)**.
   Descarga el `.csv` y **no lo subas a ningún lado**.

**Qué cuesta:** 0. **Cómo deshacerlo:** IAM → Usuarios → eliminar el usuario (y borrar sus claves). Cerrar la cuenta:
Cuenta → Cerrar cuenta (irreversible tras 90 días).

> Alternativa más segura: IAM Identity Center con inicio de sesión por SSO. Es más pasos y no se probó aquí.

---

## 2. Instalar Terraform y AWS CLI

**Dónde:** terminal de Windows (PowerShell o Git Bash).

```powershell
winget install --id Hashicorp.Terraform -e
winget install --id Amazon.AWSCLI -e
```

Cierra y vuelve a abrir la terminal (para que el PATH se actualice) y comprueba:

```bash
terraform -version
aws --version
```

**Deberías ver:** `Terraform v1.x` (el proyecto exige `>= 1.7`, `infra/terraform/main.tf`) y `aws-cli/2.x`.
Si `winget` no encuentra los paquetes, descarga los instaladores desde terraform.io y aws.amazon.com/cli
**[No verificado: los identificadores de winget no se probaron en esta máquina]**.

Configura las credenciales (te pide la clave y el secreto del `.csv`; región `us-east-1`, formato `json`):

```bash
aws configure
aws sts get-caller-identity
```

**Deberías ver:** un JSON con `Account` (12 dígitos, **anótalo**) y `Arn` terminado en `user/terraform-legrandhotel`.

**Qué cuesta:** 0. **Cómo deshacerlo:** `winget uninstall Hashicorp.Terraform` / `winget uninstall Amazon.AWSCLI`; borra
`C:\Users\<tú>\.aws\credentials`.

---

## 3. Dominio y certificado (ACM)

El proyecto necesita **dos nombres** bajo tu dominio:

- `api_domain`, p. ej. `api.legrandhotel.pe` → el balanceador (ALB).
- `web_domain`, p. ej. `app.legrandhotel.pe` → CloudFront.

Usa **subdominios** (no el dominio «pelado»): un registro CNAME no puede ir en la raíz del dominio.

### 3.1 Dominio

- Si ya tienes dominio en un registrador, sigue ahí: solo vas a crear registros DNS.
- Si no, puedes comprarlo en cualquier registrador o en Route 53 (consola → Route 53 → Dominios registrados).
  **Un dominio es un cobro anual aparte; confirma el precio antes de pagar** (no se puede deshacer una compra).
- Elige dónde vive el DNS: tu registrador o **Route 53** (zona alojada ≈ 0,50 USD/mes por zona **[No verificado]**).
  Las **pesas** del cambio gradual de `docs/migracion-servidor.md` solo existen en Route 53; con otro proveedor haces
  el cambio simple de la sección 9.

### 3.2 Certificado (debe ser en us-east-1)

Un solo certificado que cubra **los dos nombres** (lo usan el ALB y CloudFront; `variables.tf` lo exige así).

```bash
aws acm request-certificate --region us-east-1 --domain-name api.TUDOMINIO.pe --subject-alternative-names app.TUDOMINIO.pe --validation-method DNS
```

Devuelve un `CertificateArn` (**cópialo**: es `acm_certificate_arn`). Obtén los registros de validación:

```bash
aws acm describe-certificate --region us-east-1 --certificate-arn ARN_DEL_CERTIFICADO --query "Certificate.DomainValidationOptions[].ResourceRecord"
```

**Deberías ver:** dos objetos con `Name` y `Value` (CNAME). En tu proveedor de DNS crea **esos dos CNAME** tal cual
(si el panel agrega solo el dominio al final, quítalo del `Name`). Espera y consulta hasta que diga `ISSUED`:

```bash
aws acm describe-certificate --region us-east-1 --certificate-arn ARN_DEL_CERTIFICADO --query "Certificate.Status" --output text
```

Suele tardar de minutos a unos 30 min **[No verificado]**. Si pasan horas en `PENDING_VALIDATION`, los CNAME están mal puestos.

**Qué cuesta:** los certificados públicos de ACM son gratuitos. **Cómo deshacerlo:**
`aws acm delete-certificate --region us-east-1 --certificate-arn ARN` (solo si ningún recurso lo usa; después del
destroy). Deja los CNAME de validación mientras exista el certificado: ACM los usa para renovarlo.

---

## 4. Preparar `terraform.tfvars`

**Dónde:** el repositorio.

```bash
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

En PowerShell: `Copy-Item infra\terraform\terraform.tfvars.example infra\terraform\terraform.tfvars`.

Edita `infra/terraform/terraform.tfvars` (ya está en `.gitignore`) con estos valores:

| Variable | Valor | Obligatoria |
| --- | --- | --- |
| `api_domain` | `api.TUDOMINIO.pe` | sí |
| `web_domain` | `app.TUDOMINIO.pe` | sí |
| `acm_certificate_arn` | el ARN del paso 3.2 (debe ser de `us-east-1`) | sí |
| `budget_email` | tu correo (recibe la alerta de 10 USD y las alarmas) | sí |
| `extra_frontend_origins` | `["https://legrandhotel-web.onrender.com"]` mientras convivan Render y AWS (CORS de la web de Render contra la API nueva) | no (default `[]`) |
| `enable_redis` | `false` (ahorra ~12 USD/mes; caché y colas van a MySQL) | no (default `true`) |
| `enable_nat` | `false` (ahorra ~32 USD/mes) | no (default `false`) |
| `asg_min` | **`0` en el primer apply** (la imagen aún no existe en ECR) | no (default `1`) |
| `asg_max` | `3` | no |
| `rate_limit_login`, `rate_limit_register`, `rate_limit_api` | 5, 3, 60 por defecto; no los toques | no |

El resto (`region`, `environment`, `instance_type`, `db_instance_class`, `budget_limit_usd`, `github_repository`,
`api_image_tag`…) tiene valor por defecto. Si el repositorio de GitHub no es `Josephml23/LeGrandHotel`, define
`github_repository = "owner/repo"`: de eso depende que GitHub pueda desplegar.

**Qué cuesta:** 0. **Cómo deshacerlo:** borra el archivo.

---

## 5. `terraform init`, `plan` y `apply` (primer apply con `asg_min = 0`)

### 5.1 init

```bash
terraform -chdir=infra/terraform init
```

**Deberías ver:** `Terraform has been successfully initialized!` (descarga los proveedores `aws ~> 5.70` y
`random ~> 3.6`). Costo: 0.

### 5.2 plan (no crea nada)

```bash
terraform -chdir=infra/terraform plan -out=primer.tfplan
```

**Deberías ver:** un resumen `Plan: N to add, 0 to change, 0 to destroy` (N en el orden de las decenas **[No
verificado: nunca se corrió]**). Revisa que aparezcan RDS, ALB, CloudFront, S3, ECR, ASG, el rol de GitHub y las
alarmas. **Costo: 0**; un `plan` no crea nada.

Errores previsibles:

- `EntityAlreadyExists` en `aws_iam_openid_connect_provider.github`: tu cuenta ya tiene el proveedor OIDC de GitHub
  (solo puede haber uno por URL). Importa el existente:
  `terraform -chdir=infra/terraform import aws_iam_openid_connect_provider.github arn:aws:iam::TU_CUENTA:oidc-provider/token.actions.githubusercontent.com`
  (puede salir en el `apply`, no en el `plan`).
- Error de certificado o de región: el `acm_certificate_arn` debe empezar con `arn:aws:acm:us-east-1:`.

### 5.3 apply (aquí empieza el gasto)

```bash
terraform -chdir=infra/terraform apply primer.tfplan
```

Tarda unos 10–20 minutos (RDS y CloudFront son lo lento) **[No verificado]**. **Costo desde este momento:** corren
**RDS (~15/mes), ALB (~17/mes) e IPv4 públicas**; con `asg_min = 0` **no hay EC2** todavía. Es decir, ≈ 33–40 USD/mes
prorrateado por hora (~1,1 USD/día) hasta que lo destruyas.

**Deberías ver:** `Apply complete! Resources: N added` y los outputs. Si falla a la mitad, vuelve a ejecutar
`plan` y `apply`: es seguro repetir.

### 5.4 Confirmar el correo de alertas

AWS envía **dos correos** a `budget_email`: la suscripción SNS de las alarmas (`aws_sns_topic_subscription`) y, más
adelante, avisos de presupuesto. Abre el correo de SNS y pulsa **Confirm subscription**; sin eso no llegan las alarmas.

### 5.5 Anotar los outputs

```bash
terraform -chdir=infra/terraform output
terraform -chdir=infra/terraform output -json github_variables
```

Outputs reales (`outputs.tf`): `alb_dns_name`, `cloudfront_domain`, `cloudfront_distribution_id`,
`ecr_repository_url`, `rds_endpoint`, `web_bucket`, `backup_bucket`, `asg_name`, `github_variables` (mapa con
`ECR_REPOSITORY_URL`, `WEB_BUCKET`, `BACKUP_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `ASG_NAME`, `API_URL`),
`google_redirect_uri`, `ssm_prefix` y `github_deploy_role_arn`. Los usarás en los pasos 6, 7 y 8.

**Cómo deshacerlo:** sección 13 (la base tiene `deletion_protection`).

---

## 6. Secretos en SSM Parameter Store

Terraform ya creó en `/legrandhotel/prod/` las variables normales y `DB_PASSWORD`. **Faltan los secretos que no
pasan por Terraform.** Sin `APP_KEY` la instancia no arranca (`user_data` aborta si falta `APP_KEY`, `DB_PASSWORD`,
`API_IMAGE` o `BACKUP_BUCKET`).

**Regla:** ningún valor puede llevar comilla simple `'` (`user_data` los escribe entre comillas simples y se detiene).

### 6.1 APP_KEY

Si **vas a migrar los datos de Render**, usa **la misma `APP_KEY` que tiene Render** (Render → `legrandhotel-api` →
Environment). No está verificado que la app guarde algo cifrado con esa clave; reutilizarla elimina el riesgo. Si
empiezas de cero, genera una nueva:

```bash
cd api && php artisan key:generate --show
```

Copia el resultado completo, con el prefijo `base64:`. Súbela:

```bash
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name /legrandhotel/prod/APP_KEY --type SecureString --value "base64:PEGA_AQUI"
```

### 6.2 Google

Los mismos que usa Render (Google Cloud Console → Credenciales → tu ID de cliente OAuth):

```bash
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name /legrandhotel/prod/GOOGLE_CLIENT_ID --type String --value "TU_CLIENT_ID"
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name /legrandhotel/prod/GOOGLE_CLIENT_SECRET --type SecureString --value "TU_CLIENT_SECRET"
```

Y en Google Cloud Console, en **URIs de redireccionamiento autorizados**, **agrega** (no borres la de Render todavía):

```
https://api.TUDOMINIO.pe/api/v1/auth/google/callback
```

(es el output `google_redirect_uri`). Sin esto el ingreso con Google de los clientes falla.

### 6.3 DEMO_PASSWORD (solo si quieres sembrar cuentas de demostración)

**Si migras los datos reales de Render, no lo necesitas y no actives `RUN_SEED`.** Si quieres cuentas demo:

```bash
MSYS_NO_PATHCONV=1 aws ssm put-parameter --name /legrandhotel/prod/DEMO_PASSWORD --type SecureString --value "UNA_CONTRASEÑA_LARGA_Y_NUEVA"
```

Sin `DEMO_PASSWORD`, `user_data` **no siembra** aunque `RUN_SEED=true` (así no se publican cuentas con la contraseña
por defecto del repositorio). Para sembrar después: poner `RUN_SEED` en `true` con
`aws ssm put-parameter --name /legrandhotel/prod/RUN_SEED --type String --overwrite --value true`, hacer un instance
refresh, y **volver a `false`** (Terraform no pisa ese valor).

### 6.4 Comprobar

```bash
MSYS_NO_PATHCONV=1 aws ssm get-parameters-by-path --path /legrandhotel/prod/ --query "Parameters[].Name" --output text
```

**Deberías ver** (entre otros) `APP_KEY`, `DB_PASSWORD`, `API_IMAGE`, `BACKUP_BUCKET`, `DB_HOST`, `FRONTEND_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RUN_SEED`.

**Qué cuesta:** los parámetros estándar de SSM son gratuitos. **Cómo deshacerlo:**
`MSYS_NO_PATHCONV=1 aws ssm delete-parameter --name /legrandhotel/prod/APP_KEY` (cada uno).

---

## 7. GitHub: environment, secreto y variables

**Dónde:** GitHub → repositorio `Josephml23/LeGrandHotel` → **Settings**.

1. **Environments → New environment** → nombre exacto **`production`** → **Deployment branches and tags → Selected
   branches and tags → `main`**. (El rol de AWS solo confía en el token del environment `production`, ver `cicd.tf`;
   que solo `main` pueda usarlo se asegura aquí.)
2. **Secrets and variables → Actions → Secrets → New repository secret**:
   `AWS_DEPLOY_ROLE_ARN` = salida de `terraform -chdir=infra/terraform output -raw github_deploy_role_arn`.
3. **Secrets and variables → Actions → Variables → New repository variable**, una por cada clave de
   `terraform -chdir=infra/terraform output -json github_variables`:

   | Variable | Origen |
   | --- | --- |
   | `ECR_REPOSITORY_URL` | `github_variables` |
   | `WEB_BUCKET` | `github_variables` |
   | `BACKUP_BUCKET` | `github_variables` |
   | `CLOUDFRONT_DISTRIBUTION_ID` | `github_variables` |
   | `ASG_NAME` | `github_variables` |
   | `API_URL` | `github_variables` (`https://api.TUDOMINIO.pe/api/v1`) |
   | `FIRST_DEPLOY` | **`true`** (solo para el primer despliegue) |
   | `DISCORD_WEBHOOK_URL` | opcional |

   Equivalente con GitHub CLI, si lo tienes instalado y con sesión (`gh auth login`):
   `gh variable set FIRST_DEPLOY --body true` (y análogo para cada una; `gh secret set AWS_DEPLOY_ROLE_ARN`).

**Importante:** el job `deploy` solo corre si `ECR_REPOSITORY_URL` no está vacía (`deploy.yml`). Mientras no la
definas, un push a `main` no despliega nada.

**Qué cuesta:** 0 (los minutos de Actions de un repositorio público son gratis; en privado hay una cuota
**[No verificado]**). **Cómo deshacerlo:** borra las variables y el secreto; el workflow vuelve a saltarse el deploy.

---

## 8. Primer despliegue (el orden importa)

Orden exacto: **(a) apply con `asg_min=0` (ya hecho, paso 5) → (b) SSM y GitHub con `FIRST_DEPLOY=true` (pasos 6 y 7)
→ (c) lanzar el workflow → (d) apply con `asg_min=1` → (e) `FIRST_DEPLOY=false`.**

### 8.1 Lanzar el workflow

Con `FIRST_DEPLOY=true` el pipeline solo **construye y sube** la imagen a ECR, publica los archivos de despliegue en
`s3://<backup_bucket>/deploy/` y sube la web a S3. No hace instance refresh ni smoke test (no hay instancias aún).

Dos formas, sin crear commits nuevos si no quieres:

- **GitHub → Actions → Deploy → Run workflow → rama `main`** (el workflow tiene `workflow_dispatch`); o
- un `git push` a `main` normal.

Primero corre el CI completo (`ci.yml`); si falla, el deploy no arranca. **Deberías ver** todos los pasos en verde:
Login en ECR, Build y push de la API, Publicar archivos de despliegue, Build del frontend. Puede pedirte
aprobación si el environment tiene revisores.

Comprobación desde tu terminal:

```bash
aws ecr describe-images --repository-name legrandhotel-api --query "imageDetails[].imageTags"
MSYS_NO_PATHCONV=1 aws ssm get-parameter --name /legrandhotel/prod/API_IMAGE --query Parameter.Value --output text
aws s3 ls s3://NOMBRE_DEL_BACKUP_BUCKET/deploy/
```

**Deberías ver:** un tag con el SHA del commit, `API_IMAGE` terminando en ese SHA (ya no en `:bootstrap`) y 5
archivos en `deploy/`. Si `API_IMAGE` sigue en `:bootstrap`, la instancia fallará al arrancar.

### 8.2 Encender la primera instancia (`asg_min = 1`)

Edita `infra/terraform/terraform.tfvars`: `asg_min = 1`. Luego:

```bash
terraform -chdir=infra/terraform apply
```

**Deberías ver:** `1 to change` (el ASG). **Desde aquí corre la EC2 (~15 USD/mes)**; total ≈ 45 USD/mes.

El ASG ignora los cambios en `desired_capacity` (`compute.tf`). Comprueba que de verdad subió a 1:

```bash
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names legrandhotel-prod-api --query "AutoScalingGroups[0].[MinSize,DesiredCapacity,Instances[].LifecycleState]"
```

Si `DesiredCapacity` sigue en `0`, fuerza la instancia:

```bash
aws autoscaling set-desired-capacity --auto-scaling-group-name legrandhotel-prod-api --desired-capacity 1
```

**[No verificado]** si AWS sube solo la capacidad deseada al subir el mínimo; el comando de arriba lo resuelve en
cualquier caso.

### 8.3 Esperar a que arranque

La instancia instala Docker, baja los archivos de S3, ejecuta `migrate --force` y `db:seed --class=RoleSeeder`, y
levanta los contenedores. Calcula **5–10 minutos** **[No verificado]**. Mira el estado del balanceador:

```bash
aws elbv2 describe-target-health --target-group-arn $(aws elbv2 describe-target-groups --names legrandhotel-prod-api --query "TargetGroups[0].TargetGroupArn" --output text)
```

**Deberías ver:** `"State": "healthy"`. Prueba sin DNS (el certificado no coincidirá con el nombre del ALB, por eso `-k`):

```bash
curl -k https://NOMBRE_ALB.us-east-1.elb.amazonaws.com/api/v1/health
```

**Deberías ver:** HTTP 200 con `"status":"ok"` y la base en `ok`. El `NOMBRE_ALB` es el output `alb_dns_name`.

> **Riesgo [No verificado]:** el ASG tiene `health_check_grace_period = 120` s y el arranque (instalar Docker, bajar
> imágenes, migrar) puede tardar más. Si el ASG termina y recrea la instancia en bucle, mira el log de la instancia
> (sección «Si algo falla») y sube `health_check_grace_period` en `infra/terraform/compute.tf` (p. ej. a 600) con otro
> `apply`.

### 8.4 Cerrar el primer despliegue

GitHub → Settings → Variables → `FIRST_DEPLOY` = **`false`** (o bórrala). Desde aquí cada push a `main` hace
instance refresh gradual, smoke test k6 y **rollback automático** a la imagen anterior si falla (`deploy.yml`).

**Cómo deshacerlo (todo el paso 8):** `asg_min = 0` y `apply`, y `aws autoscaling set-desired-capacity ... 0`.

---

## 9. Migración de datos: de PostgreSQL (Render) a MySQL (RDS)

### 9.1 Decide si de verdad hay datos que conservar

| Situación | Qué hacer |
| --- | --- |
| La base de Render solo tiene datos de demostración | **Salta la exportación.** Siembra con los seeders: `RUN_SEED=true` + `DEMO_PASSWORD` (paso 6.3). Es el camino más seguro. |
| Hay reservas, clientes o inventario reales | Sigue con 9.2–9.6. |

**No existe un script oficial de migración.** El método de abajo es el que el proyecto propone; **no se ejecutó nunca**.
Los motores son distintos (PostgreSQL ≠ MySQL), así que **hazlo primero como ensayo** y compara conteos.

### 9.2 Riesgos (léelos antes)

- **No es una copia exacta:** se exportan los *datos* como sentencias `INSERT` y el esquema lo crea Laravel con las
  migraciones en MySQL. Si una columna tiene un tipo que difiere (p. ej. booleanos, JSON, fechas con zona horaria),
  el `INSERT` puede fallar o convertir mal. Solo compararás a mano.
- **Fechas:** PostgreSQL escribe `2026-11-10 12:00:00+00`. MySQL 8.0.19+ acepta el desfase en literales, pero **no está
  verificado** con este esquema. Revisa reservas y fechas de entrada/salida después.
- **Datos que cambian durante el copiado:** la base de Render sigue recibiendo reservas. Hay que congelar escrituras
  en el corte (9.5).
- **Render no tiene consola** (plan gratuito): no puedes ejecutar `artisan` allí. Todo se hace desde fuera.
- **La base gratuita de Render vence a los 30 días** de creada (`docs/despliegue-render.md`). Si ya venció, los datos
  se perdieron: no hay nada que migrar.
- **Secuencias:** MySQL usa `AUTO_INCREMENT`, que se ajusta solo al insertar ids explícitos. Aun así crea una
  reserva de prueba después y confirma que no choca.
- **Tokens y sesiones no se migran** (`personal_access_tokens`, `sessions`, `cache`, `jobs`): todos tendrán que
  volver a iniciar sesión.
- **Contraseñas del personal:** se guardan con hash bcrypt, funcionan igual en MySQL. Los **clientes** entran con
  Google, que seguirá igual si registraste la URI nueva (paso 6.2).

### 9.3 Exportar desde Render (PostgreSQL)

1. En Render → `legrandhotel-db` → **Connections → External Database URL** (la cadena
   `postgresql://usuario:clave@host/base`). **Contiene la contraseña: no la pegues en chats ni la guardes en el
   repositorio.** (Si Render bloquea conexiones externas en tu plan, **[No verificado]** habría que abrir la lista de
   IP permitidas en el panel de la base.)
2. En tu equipo (Docker Desktop encendido; usa la imagen oficial para no instalar PostgreSQL). Git Bash:

```bash
export RENDER_DB_URL='postgresql://USUARIO:CLAVE@HOST/BASE'
docker run --rm postgres:16 pg_dump "$RENDER_DB_URL" --data-only --column-inserts --rows-per-insert=200 --no-owner --no-privileges -t roles -t users -t role_user -t clients -t staff -t room_types -t rooms -t reservations -t stays -t parking_spots -t parking_assignments -t inventory_items -t inventory_movements -t audit_logs > render-datos.sql
```

PowerShell (la variable y la redirección cambian; usa UTF-8 sin BOM, por eso se escribe con `--file` dentro del
contenedor montando una carpeta):

```powershell
$env:RENDER_DB_URL = 'postgresql://USUARIO:CLAVE@HOST/BASE'
docker run --rm -v ${PWD}:/out -e RENDER_DB_URL postgres:16 sh -c 'pg_dump "$RENDER_DB_URL" --data-only --column-inserts --rows-per-insert=200 --no-owner --no-privileges -t roles -t users -t role_user -t clients -t staff -t room_types -t rooms -t reservations -t stays -t parking_spots -t parking_assignments -t inventory_items -t inventory_movements -t audit_logs --file=/out/render-datos.sql'
```

Las tablas **excluidas a propósito** son `migrations`, `cache`, `cache_locks`, `sessions`, `jobs`, `job_batches`,
`failed_jobs`, `password_reset_tokens` y `personal_access_tokens`. (Lista de tablas tomada de
`api/database/migrations/`; si se añade una migración con tablas nuevas, agrégalas con otro `-t`.)

**Guarda `render-datos.sql` fuera del repositorio y no lo subas a ningún lado: contiene datos personales de huéspedes
y hashes de contraseñas.** Qué cuesta: 0.

### 9.4 Adaptarlo a MySQL

Crea `mysql-datos.sql` con el encabezado y el cuerpo ajustado. En Git Bash:

```bash
{
  echo "SET NAMES utf8mb4; SET FOREIGN_KEY_CHECKS=0; SET sql_mode='ANSI_QUOTES,NO_BACKSLASH_ESCAPES,NO_AUTO_VALUE_ON_ZERO';"
  for t in role_user roles users clients staff room_types rooms reservations stays parking_spots parking_assignments inventory_items inventory_movements audit_logs; do echo "TRUNCATE TABLE \"$t\";"; done
  grep -v -E '^(SET |SELECT pg_catalog|--)' render-datos.sql | sed 's/public\.//g'
  echo "SET FOREIGN_KEY_CHECKS=1;"
} > mysql-datos.sql
```

Qué hace cada ajuste:

- `ANSI_QUOTES` permite que MySQL lea los identificadores `"users"` / `"id"` que escribe PostgreSQL.
- `NO_BACKSLASH_ESCAPES` coincide con cómo PostgreSQL escribe las cadenas (las comillas se duplican `''`; la barra
  invertida es literal).
- `FOREIGN_KEY_CHECKS=0` evita el orden de dependencias; los `TRUNCATE` vacían las tablas que `RoleSeeder`
  (o el seed demo) ya llenó, para que los ids de roles de Render no choquen.
- Se descartan los `SET` y comentarios propios de PostgreSQL y el prefijo `public.`.

**Esto es lo más frágil del proceso [No verificado].** Antes de importar, abre `mysql-datos.sql` y revisa las primeras
líneas de cada tabla: no debe quedar sintaxis exclusiva de PostgreSQL (`::`, `E'...'`, `true`/`false` están bien en
MySQL; `E'...'` o `::tipo` no). Si aparecen, hay que corregirlas a mano.

### 9.5 Cargar en RDS

La base está en **subred privada** (`publicly_accessible = false`): no se puede entrar desde tu PC. Se entra **desde la
EC2**, con **Session Manager** (la instancia ya tiene el rol `AmazonSSMManagedInstanceCore`).

1. Sube el archivo al bucket de respaldos, en el prefijo `mysql/` (el rol de la instancia lee `mysql/*`):

```bash
aws s3 cp mysql-datos.sql s3://NOMBRE_DEL_BACKUP_BUCKET/mysql/importacion/mysql-datos.sql
```

2. **Consola de AWS → EC2 → Instancias →** selecciona `legrandhotel-prod-api` → **Conectar → Session Manager →
   Conectar** (no necesitas instalar nada ni abrir puertos). Es una terminal del navegador.
3. Dentro de esa terminal:

```bash
sudo -i
cd /opt/legrandhotel
set -a; . ./.env; set +a
BUCKET=$(grep -m1 '^BACKUP_BUCKET=' .env | cut -d= -f2- | tr -d "'")
aws s3 cp "s3://$BUCKET/mysql/importacion/mysql-datos.sql" /tmp/mysql-datos.sql
docker run --rm -i -e MYSQL_PWD="$DB_PASSWORD" mysql:8.4 mysql -h "$DB_HOST" -u "$DB_USERNAME" "$DB_DATABASE" < /tmp/mysql-datos.sql
```

**Deberías ver:** ningún mensaje (silencio = éxito) o un `ERROR 1064 ... near ...` con la línea que falló. Si falla,
**las tablas pueden haber quedado a medias**: corrige el SQL y repite desde el `TRUNCATE`; es seguro repetirlo.

4. Compara conteos con lo que ves en Render (por ejemplo desde la web o con `psql`), tabla por tabla:

```bash
docker run --rm -e MYSQL_PWD="$DB_PASSWORD" mysql:8.4 mysql -h "$DB_HOST" -u "$DB_USERNAME" "$DB_DATABASE" -e "SELECT 'users',COUNT(*) FROM users UNION ALL SELECT 'clients',COUNT(*) FROM clients UNION ALL SELECT 'reservations',COUNT(*) FROM reservations UNION ALL SELECT 'inventory_items',COUNT(*) FROM inventory_items UNION ALL SELECT 'rooms',COUNT(*) FROM rooms;"
```

5. Borra el archivo del bucket y de la instancia: `aws s3 rm s3://$BUCKET/mysql/importacion/mysql-datos.sql` y
   `rm /tmp/mysql-datos.sql`.

**Qué cuesta:** céntimos de S3 y transferencia. **Cómo deshacerlo:** repite el `TRUNCATE` (o restaura el snapshot de
RDS tomado antes, ver abajo).

### 9.6 Ensayo y corte definitivo

1. **Ensayo:** haz 9.3–9.5 una vez, con la web de Render **aún en servicio**, y verifica la sección 10 contra AWS.
   Los datos del ensayo se sobrescriben en el corte.
2. **Antes del corte:** toma un snapshot manual de RDS (queda como punto de retorno):
   `aws rds create-db-snapshot --db-instance-identifier legrandhotel-prod-mysql --db-snapshot-identifier antes-del-corte`
3. **Corte (ventana de unos minutos):** avisa al equipo → en Render **suspende `legrandhotel-api`** (Settings →
   Suspend; así nadie escribe y la base sigue legible) → repite 9.3, 9.4 y 9.5 con la base ya congelada → verifica
   conteos y la sección 10 → cambia el DNS (sección 11).
4. **Si algo sale mal:** reactiva el servicio en Render (Resume): sigue siendo la fuente de verdad mientras no hayas
   tocado el DNS ni abierto a usuarios en AWS. Anota todo en `docs/incidentes.md`.

---

## 10. Verificación (checklist)

Hazla contra la API nueva antes de mover usuarios (con el DNS ya apuntando o con `curl -k` al `alb_dns_name`).

- [ ] **Salud de la API:**
      ```bash
      curl https://api.TUDOMINIO.pe/api/v1/health
      ```
      Debe responder `200` con `"status":"ok"` y la base en `ok`.
- [ ] **Web carga:** abre `https://app.TUDOMINIO.pe` (candado válido, sin errores de CORS en la consola del navegador).
- [ ] **Login del personal** (correo y contraseña) con una cuenta real migrada, o con una cuenta demo si sembraste.
      Un cuarto intento fallido debe mostrar la espera (`LOGIN_LOCKED`), igual que en Render.
- [ ] **Login con Google** de un cliente (confirma que la URI de redirección del paso 6.2 está bien).
- [ ] **Reserva de prueba:** crea una reserva (huésped → fechas → habitación disponible), haz check-in y check-out, y
      bórrala o cancélala. Confirma que no choca con ids existentes (9.2, secuencias).
- [ ] **Datos migrados:** los conteos de reservas, clientes e inventario coinciden con Render; revisa fechas de entrada y
      salida de unas cuantas reservas.
- [ ] **App Flutter apuntando a la nueva API.** Desde `mobile/` (`mobile/README.md` explica cómo correrla):
      ```bash
      cd mobile
      flutter run --dart-define=API_URL=https://api.TUDOMINIO.pe/api/v1
      ```
      Para un APK: `flutter build apk --dart-define=API_URL=https://api.TUDOMINIO.pe/api/v1`. Entra con una cuenta del
      personal y comprueba Hoy, Habitaciones e Inventario. **La app no necesita CORS** (no es un navegador).
- [ ] **Logs y alarmas:** CloudWatch → Log groups → `/legrandhotel/api` recibe líneas; ninguna alarma en `ALARM`.
- [ ] **Correo de alertas confirmado** (paso 5.4).
- [ ] **Smoke test del pipeline:** haz un push trivial a `main` (`FIRST_DEPLOY=false`) y comprueba que el instance
      refresh y el smoke test k6 terminan en verde.

---

## 11. Cambio de DNS sin cortes

Se apoya en `docs/migracion-servidor.md` (bajar TTL, cambio gradual, reversa, mantener lo viejo 48 h).

### 11.1 Dos casos

**Caso A: Render usa hoy las direcciones `*.onrender.com`** (es lo normal en este proyecto). Entonces **no hay un DNS
que cambiar para los usuarios actuales**: la dirección nueva es otra. La «migración» consiste en publicar las
direcciones nuevas, apuntar la app y los accesos a ellas, y dejar Render unos días como respaldo.

**Caso B: ya tenías un dominio propio apuntando a Render.** Ahí sí cambias registros; sigue 11.2–11.4.

### 11.2 Registros que crear (en tu proveedor de DNS o Route 53)

| Nombre | Tipo | Valor | Qué es |
| --- | --- | --- | --- |
| `api.TUDOMINIO.pe` | CNAME (en Route 53 mejor «Alias» a ALB) | output `alb_dns_name` | La API |
| `app.TUDOMINIO.pe` | CNAME (en Route 53 mejor «Alias» a CloudFront) | output `cloudfront_domain` | La web |

Puedes crearlos **antes del corte** en un dominio nuevo: no afectan a nadie porque nadie los usa todavía.

### 11.3 Cambio sin cortes (Caso B)

1. **Un día antes**, baja el TTL de los registros actuales a **60 s** (así el cambio se propaga en minutos).
2. Si usas Route 53, pon **registros ponderados** (10 % → 50 % → 100 % hacia AWS) como indica
   `docs/migracion-servidor.md`; con otro proveedor haz el cambio de una vez en la ventana del corte (9.6).
3. Vigila CloudWatch (5xx y latencia). Umbral de reversa del documento: **5xx > 10/min o p95 > 800 ms durante 5 min**.
4. **Reversa:** devuelve el registro a Render (o peso 100 % a Render) y, si ya aceptaste escrituras en AWS, ten en
   cuenta que esos datos **no vuelven solos** a Render (no hay replicación entre los dos motores).

### 11.4 Después del cambio

- Cuando AWS esté estable: quita `extra_frontend_origins` de `terraform.tfvars` y aplica (cierra el CORS de Render).
- Elimina de Google Cloud Console la URI de redirección de Render cuando apagues Render.
- Recompila la app móvil con `--dart-define=API_URL=https://api.TUDOMINIO.pe/api/v1` y distribúyela.

**Qué cuesta:** Route 53 (si lo usas): ~0,50 USD/mes por zona y fracciones de centavo por consulta **[No verificado]**.

---

## 12. Apagar Render

Solo cuando AWS lleve **al menos 48 h estable** (plazo de `docs/migracion-servidor.md`, paso 7) y hayas verificado
la sección 10.

1. **Copia de seguridad final** de la base de Render (antes de borrarla), con el comando del paso 9.3 pero **sin
   `--data-only` ni `-t`** (esquema + datos completos) a un archivo fuera del repositorio.
2. En Render: `legrandhotel-api`, `legrandhotel-web` y `legrandhotel-db` → **Settings → Suspend** (reversible).
3. Pasada una semana sin problemas, **Delete** (irreversible). La base gratuita ya vence sola a los 30 días.
4. Quita en Google Cloud Console la URI de `https://legrandhotel-api.onrender.com/api/v1/auth/google/callback`.
5. Si Render tenía integraciones (deploy hooks, secretos en GitHub), bórralas.

**Qué cuesta:** el plan usado de Render es gratuito. **Cómo deshacerlo:** suspender es reversible; borrar no.

---

## 13. Cómo apagar para no gastar

### 13.1 Pausar (barato, no cero)

Útil entre exámenes o demostraciones. **No deja el gasto en cero:** el **ALB (~17 USD/mes) y las IPv4 siguen
cobrando**, y el almacenamiento de RDS y el de S3 también.

```bash
aws autoscaling update-auto-scaling-group --auto-scaling-group-name legrandhotel-prod-api --min-size 0 --desired-capacity 0
aws rds stop-db-instance --db-instance-identifier legrandhotel-prod-mysql
```

Pon también `asg_min = 0` en `terraform.tfvars` para que el siguiente `apply` no lo deshaga. **Un RDS detenido se
vuelve a encender solo a los 7 días** (hay que detenerlo otra vez). Para reencender: `aws rds start-db-instance ...`,
`asg_min = 1` y `apply`. Ahorro aproximado: la EC2 (~15 USD/mes) y la mayor parte del RDS (~15 USD/mes)
**[No verificado]**.

### 13.2 Destruir todo (gasto cero)

Antes decide si quieres conservar datos: **`terraform destroy` borra la base de datos** (se deja un snapshot final, ver
más abajo) y los respaldos.

1. **Respaldo propio** (opcional, recomendado): `aws s3 sync s3://NOMBRE_DEL_BACKUP_BUCKET/mysql ./respaldos-aws`.
2. **`deletion_protection`:** el RDS lo tiene en `true` (`data.tf`), así que `destroy` fallará hasta que lo apagues:

   ```bash
   aws rds modify-db-instance --db-instance-identifier legrandhotel-prod-mysql --no-deletion-protection --apply-immediately
   ```

   (Alternativa: poner `deletion_protection = false` en `infra/terraform/data.tf` y hacer `apply`.)
3. **Snapshot final:** `skip_final_snapshot = false` y `final_snapshot_identifier = legrandhotel-prod-mysql-final`: al
   destruir, AWS guarda ese snapshot (**sigue cobrando almacenamiento, céntimos por GB/mes [No verificado]** y no lo
   borra `destroy`). Si ya existe uno con ese nombre de un intento anterior, **bórralo antes** o `destroy` fallará:
   `aws rds delete-db-snapshot --db-snapshot-identifier legrandhotel-prod-mysql-final`. Cuando ya no lo necesites,
   bórralo igual para no pagar.
4. **Vaciar S3 y ECR.** Los buckets y el repositorio **no** tienen `force_destroy`/`force_delete` en el Terraform, y
   `destroy` falla si no están vacíos. Lo más simple: consola de AWS → **S3** → cada bucket (`legrandhotel-prod-web-…`
   y `legrandhotel-prod-backups-…`) → **Vaciar** (el de respaldos está versionado: la consola borra también las
   versiones); y **ECR** → `legrandhotel-api` → seleccionar todas las imágenes → **Eliminar**.
5. **Destruir:**

   ```bash
   terraform -chdir=infra/terraform destroy
   ```

   Escribe `yes`. Tarda unos 10–20 min (CloudFront es lo lento) **[No verificado]**. **Deberías ver:** `Destroy
   complete!`.
6. **Lo que Terraform no borra y debes limpiar a mano:**
   - Parámetros de SSM cargados a mano:
     `MSYS_NO_PATHCONV=1 aws ssm delete-parameters --names /legrandhotel/prod/APP_KEY /legrandhotel/prod/GOOGLE_CLIENT_ID /legrandhotel/prod/GOOGLE_CLIENT_SECRET /legrandhotel/prod/DEMO_PASSWORD`
     (el último puede no existir; no pasa nada).
   - Certificado ACM (y los CNAME de validación), registros `api.` y `app.` en tu DNS, y la zona de Route 53 si
     solo se usaba para esto (**0,50 USD/mes**).
   - Snapshots manuales de RDS (los tomados con `create-db-snapshot` y el final).
   - Si cambiaste el backend a S3 para el estado, ese bucket aparte.
   - Grupos de logs de CloudWatch que queden (consola → CloudWatch → Log groups).
7. **Comprueba que no queda nada que cobre:** consola → **Billing → Cost Explorer** (el gasto del día baja a 0 en
   uno o dos días) y **Resource Groups → Tag Editor** filtrando por la etiqueta `Project = LeGrandHotel`
   **[No verificado]**. Revisa también EC2, RDS, ALB, NAT Gateways, IP elásticas y CloudFront de `us-east-1`.
8. **Quita el acceso:** borra las claves del usuario IAM y el usuario (paso 1), el secreto y las variables de GitHub,
   y el environment `production`.

**Orden de gasto si solo apagas:** lo que más cobra es ALB + RDS + EC2; si solo puedes parar una cosa por semana, la
EC2 y el RDS (13.1) son lo más fácil de reencender.

---

## 14. Si algo falla

| Síntoma | Qué mirar |
| --- | --- |
| `terraform apply` falla con `EntityAlreadyExists` (OIDC) | Importar el proveedor (paso 5.2) |
| El workflow falla en «Configure AWS Credentials» | El environment `production` no existe o no permite `main`; `AWS_DEPLOY_ROLE_ARN` mal copiado; `github_repository` no coincide con `owner/repo` |
| El workflow falla en el smoke test o en el instance refresh | Es el rollback automático; mira CloudWatch Logs `/legrandhotel/api` y regístralo en `docs/incidentes.md` |
| La instancia no pasa a `healthy` | Consola → EC2 → instancia → Conectar → Session Manager → `sudo cat /var/log/cloud-init-output.log`. Lo más común: falta `APP_KEY` o hay una comilla simple en un parámetro de SSM (el script aborta con un `ERROR:` explícito) |
| `/health` responde 503 o la base en error | Credenciales/host de RDS en SSM (`DB_HOST`, `DB_PASSWORD`); `docker compose logs app` en la instancia |
| La web carga pero la API da error de CORS | `FRONTEND_URL` (SSM) debe contener el origen exacto (`https://app.TUDOMINIO.pe`); si usas la web de Render, `extra_frontend_origins` y reiniciar con instance refresh |
| Ingreso con Google falla | La URI de redirección de Google no coincide con `google_redirect_uri` |
| `destroy` falla | `deletion_protection` activa, bucket/ECR sin vaciar o snapshot final ya existente (13.2) |

## Notas que no se pudieron verificar

- Ninguna orden de `terraform`, `aws` o `winget` se ejecutó al escribir esta guía.
- MySQL 8.4 en RDS no se ha probado contra este esquema (el propio `/health` lo confirma en el paso 8.3).
- El método de migración PostgreSQL → MySQL (9.3–9.5) es una propuesta sin probar; el ensayo es obligatorio.
- Tiempos (acm, apply, arranque de la instancia, destroy), el precio del dominio y del snapshot final son estimaciones.
- Que el ASG suba `DesiredCapacity` al subir `asg_min` (paso 8.2) y que el `health_check_grace_period = 120` alcance para
  el primer arranque.
- Que la base de Render acepte conexiones externas desde tu IP.
