# Lokales Traefik-Routing

CarpentersProduction startet Traefik und erzeugt das gemeinsame Docker-Netzwerk
`carpenters-proxy`. Die MoebelDesignSuite bindet dieses Netzwerk extern ein und
ist unter `http://suite.localhost` erreichbar.

Auf demselben Docker-Host wird nur der zentrale Traefik-Service aus
CarpentersProduction gestartet. Die anderen Compose-Projekte stellen keinen
eigenen Traefik-Container bereit, sondern hängen nur ihre Web-Services in
`carpenters-proxy` ein.

Die Web-Services der anderen Compose-Projekte können dasselbe Netzwerk nutzen:

| Projekt | Hostname |
| --- | --- |
| MoebelDesignSuite | `suite.localhost` |
| Carpenters | `av.localhost` |
| MoebelDesignLicencing | `licence.localhost` |
| Carpenters-Dokumentation | `docs.localhost` |

Da die anderen Anwendungen in eigenständigen Compose-Projekten liegen, binden
sie das von diesem Stack erzeugte Netzwerk als externes Netzwerk ein:

```yaml
services:
  web:
    networks:
      - carpenters-proxy
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=carpenters-proxy"
      - "traefik.http.routers.meine-anwendung.rule=Host(`av.localhost`)"
      - "traefik.http.routers.meine-anwendung.entrypoints=web"
      - "traefik.http.services.meine-anwendung.loadbalancer.server.port=80"

networks:
  carpenters-proxy:
    external: true
    name: carpenters-proxy
```

Der veröffentlichte interne Port muss zum jeweiligen Container passen. Der
CarpentersProduction-Stack muss zuerst laufen, damit das Netzwerk bereits existiert.
`.localhost` wird lokal per HTTP verwendet; öffentliche ACME-/Let's-Encrypt-
Zertifikate sind für diese Namen nicht verfügbar.
