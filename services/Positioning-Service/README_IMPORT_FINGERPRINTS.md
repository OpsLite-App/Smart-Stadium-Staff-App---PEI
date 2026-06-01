# Importar Fingerprints para o Positioning-Service

Este script lê um ficheiro CSV/TSV/XLSX de access points e converte cada `location_id` num fingerprint que é enviado para o endpoint `POST /fingerprints`.

## Formato de entrada esperado

O ficheiro deve ter seis colunas:

- `location_id`
- `zone`
- `x`
- `y`
- `bssid`
- `rssi`

O separador pode ser `,`, `;`, `\t`, ou outro reconhecido pelo Python CSV Sniffer.

### Exemplo de linha

```
1,36,1,1,1,14:77:40:89:be:ac,-81
```

ou com cabeçalho:

```
location_id,zone,x,y,bssid,rssi
1,36,1,1,1,14:77:40:89:be:ac,-81
```

## Como usar

A partir de `services/Positioning-Service`:

```bash
python import_fingerprints.py path/para/seu_ficheiro.csv --url http://localhost:8000/fingerprints
```

Para apenas validar o ficheiro sem enviar dados:

```bash
python import_fingerprints.py path/para/seu_ficheiro.csv --dry-run
```

## Requisitos

O script usa o pacote `httpx` e o ambiente do serviço deve ter as dependências do `requirements.txt` instaladas.

Se ainda não instalou:

```bash
pip install -r requirements.txt
```

## O que faz

- agrupa os APs por `location_id`
- constrói `rssi_map` com `{bssid: rssi}`
- mantêm `x`, `y`, `zone` por local
- envia cada fingerprint para o Positioning-Service

## Avisos

- se existirem coordenadas inconsistentes para o mesmo `location_id`, o script falha e indica o erro.
- o script normaliza BSSID para minúsculas.
