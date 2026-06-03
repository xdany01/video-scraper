# 🎬 video-scraper

CLI en TypeScript/Node.js para descargar videos desde sitios web con estructura de carpetas.

## Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Compilar e instalar el comando globalmente:**
   Hemos añadido scripts en el [package.json](file:///c:/Users/Daniel/Documents/My%20Proyects/video-scraper/package.json) para simplificar este proceso:
   
   * **Para desarrollo (enlace simbólico - recomendado)**:
     ```bash
     npm run link-cli
     ```
   * **Para uso general (instalación global)**:
     ```bash
     npm run install-cli
     ```

   > [!TIP]
   > **Nota para Windows (PowerShell)**: Si tienes las políticas de script deshabilitadas y obtienes un error con `npm`, utiliza `npm.cmd` en su lugar (por ejemplo: `npm.cmd run link-cli`).

---

## Uso

Una vez instalado globalmente, puedes utilizar el comando `video-scraper` directamente desde cualquier carpeta de tu terminal.

### Descargar todo

```bash
video-scraper download https://ejemplo.com/videos/
```

Con opciones:
```bash
video-scraper download https://ejemplo.com/videos/ --output ./mis-videos --concurrency 5 --delay 300
```

### Solo explorar (sin descargar)

```bash
video-scraper tree https://ejemplo.com/videos/
```

Útil para ver qué hay antes de descargar.

### Simular descarga (dry-run)

```bash
video-scraper download https://ejemplo.com/videos/ --dry-run
```

Muestra qué se descargaría sin tocar ningún archivo.

---

## Opciones del comando `download`

| Opción | Default | Descripción |
|---|---|---|
| `-o, --output <dir>` | `./downloads` | Directorio de salida |
| `-c, --concurrency <n>` | `3` | Descargas paralelas simultáneas |
| `-r, --retries <n>` | `3` | Reintentos ante fallo |
| `-d, --delay <ms>` | `200` | Pausa entre requests (ms) |
| `-e, --extensions <exts>` | `mp4,mkv,avi,...` | Extensiones de video a buscar |
| `--dry-run` | — | Simula sin descargar |
| `--no-tree` | — | Omite mostrar el árbol |
| `-v, --verbose` | — | Logs detallados |
| `--user-agent <ua>` | ver código | User-Agent HTTP personalizado |

---

## Cómo funciona

1. **Crawling**: Parte de la URL raíz y sigue todos los links `<a href>` que sean sub-rutas de la misma. Detecta carpetas (URLs que terminan en `/` o sin extensión) y archivos de video por extensión.

2. **Árbol**: Antes de descargar muestra la estructura encontrada en formato árbol.

3. **Descarga**: Descarga los archivos en paralelo (configurable). Respeta la misma estructura de carpetas localmente. Si un archivo ya existe, lo saltea.

4. **Resumen**: Al final muestra estadísticas de descargados, saltados, fallidos y bytes totales.

---

## Estructura del proyecto

```
src/
  index.ts      ← CLI principal (Commander)
  crawler.ts    ← Lógica de crawling con Cheerio
  downloader.ts ← Descarga con barra de progreso
  tree.ts       ← Impresión del árbol y utilidades
  logger.ts     ← Colores y formateo
  types.ts      ← Interfaces TypeScript
```

## Dependencias

- **cheerio** — parseo de HTML estático
- **node-fetch** — requests HTTP
- **commander** — CLI framework
- **chalk** — colores en terminal
- **cli-progress** — barra de progreso
