# cep-proximity-api

API que recebe um CEP e devolve os CEPs encontrados a até 1 km. Cada item traz o CEP formatado e a distância em quilômetros. O CEP de origem fica de fora da lista.

A lista reflete o que a AwesomeAPI devolve para aquele ponto. Um CEP existente pode não aparecer se o provedor não o incluir na busca.

## Tecnologias

- Node.js e TypeScript
- NestJS
- Redis, via ioredis
- AwesomeAPI CEP, via Axios
- Limite de entrada com `@nestjs/throttler`

## Pré-requisitos

- Node.js 22 ou superior
- npm
- Chave da AwesomeAPI
- Redis acessível na URL configurada

Com Docker Compose, o Redis sobe junto com a API.

## Configuração

Copie `.env.example` para `.env` e preencha `AWESOME_API_KEY`. A chave é obrigatória. A aplicação envia essa chave somente no header `x-api-key`.

Campos vazios usam estes valores:

| Variável | Default |
| --- | --- |
| `PORT` | `3000` |
| `REDIS_URL` | `redis://localhost:6379` |
| `AWESOME_API_BASE_URL` | `https://cep.awesomeapi.com.br` |
| `AWESOME_API_TIMEOUT_MS` | `5000` |
| `INBOUND_RATE_LIMIT_MAX` | `30` |
| `INBOUND_RATE_LIMIT_WINDOW_MS` | `60000` |
| `AWESOME_API_RATE_LIMIT_MAX` | `5` |
| `AWESOME_API_RATE_LIMIT_WINDOW_MS` | `1000` |

No Compose, `REDIS_URL` é `redis://redis:6379`, independentemente do valor no `.env`.

## Execução

Local, com Redis já acessível:

```bash
npm ci
npm run start:dev
```

Com Docker Compose:

```bash
docker compose up --build
```

A API fica em `http://localhost:3000`. Para encerrar:

```bash
docker compose down
```

## Endpoint principal

`GET /ceps-proximos/:cep`

O CEP aceita oito dígitos ou o formato `00000-000`, com zeros à esquerda preservados. `01001000` e `01001-000` são o mesmo CEP. Um valor como `36.000-000` responde 400.

A resposta é um array. Uma lista vazia é uma resposta válida e também fica em cache.

```http
GET /ceps-proximos/01001000
```

```json
[
  { "cep": "01002-000", "distancia_km": 0.35 },
  { "cep": "01003-000", "distancia_km": 0.81 }
]
```

Os CEPs e as distâncias acima ilustram o formato. O conteúdo real depende da AwesomeAPI e da distância calculada.

Corpo de erro: `{ "statusCode", "message" }`.

| Status | Situação | Mensagem |
| --- | --- | --- |
| 400 | CEP fora do formato | `Invalid postal code` |
| 404 | CEP não encontrado no geocoding | `Postal code was not found` |
| 429 | Limite de entrada excedido | `ThrottlerException: Too Many Requests` |
| 500 | Falha inesperada | `Internal server error` |
| 503 | Falha externa, payload inválido ou Redis na invalidação | `External service request failed`, `External payload is missing numeric coordinates` ou `Redis <operação> failed` |

## Health e invalidação de cache

`GET /health` devolve `{ "status": "ok" }`. Essa rota fica fora do limite de entrada.

`DELETE /cache/ceps/01001000` remove o geocoding e a busca daquele CEP. O CEP segue as mesmas regras de formato do endpoint principal.

`DELETE /cache/ceps` percorre com SCAN as chaves do prefixo `nearby-ceps-api:` e as remove.

As duas rotas respondem `{ "removed": number }`. CEP inválido na invalidação individual responde 400. Se o Redis falhar durante a remoção, a resposta é 503.

## Geocoding e busca

1. O CEP é validado.
2. A API consulta o cache da busca, com TTL de 6 horas.
3. Em caso de miss, o geocoding chama `GET /json/{cep}`.
4. A busca geográfica chama `GET /search` com `lat`, `lng`, `d=1`, `sort=asc`, `limit=10`, `page` e `format=json`.
5. A distância publicada é calculada localmente com Haversine, usando raio terrestre de 6371 km.

O parâmetro `d=1` pede à AwesomeAPI candidatos em torno de 1 km. O filtro local decide o que permanece na resposta.

## Paginação e falhas

As páginas são pedidas em sequência, com 10 itens, até no máximo 500 páginas. A leitura para quando a página vem curta ou quando `found` indica que a última página já foi lida. Se `found` não vier, a parada acontece na página curta.

A busca inteira falha, com 503, quando uma página responde status diferente de 200, o payload não traz coordenada numérica, a mesma página se repete ou `found` exige mais de 500 páginas. O resultado parcial não entra no cache. Não há nova tentativa automática.

Itens idênticos em CEP, latitude e longitude são descartados ainda na leitura das páginas.

## Distância, ordenação e deduplicação

A distância bruta entra na lista quando é menor ou igual a `1 + 1e-9`. O corte acontece antes do arredondamento: `1.004` fica de fora, e um valor dentro do raio pode ser publicado como `1.00`.

Se o mesmo CEP aparecer mais de uma vez, permanece a menor distância. A ordenação usa essa distância bruta e, no empate, o CEP. Depois da ordenação, o valor é arredondado half-up para duas casas decimais: `1.005` vira `1.01`.

## Cache

| Dado | Chave lógica | TTL |
| --- | --- | --- |
| Geocoding | `geocoding:{cep}` | 7 dias (`604800` s) |
| Busca | `nearby-ceps:{cep}` | 6 horas (`21600` s) |

A coordenada de um CEP muda raramente. Sete dias evitam repetir `GET /json/{cep}` e aceitam uma coordenada defasada por até uma semana. A vizinhança muda com mais frequência, então seis horas atualizam a busca em troca de mais chamadas a `/search`.

As chaves físicas usam o prefixo `nearby-ceps-api:`. A lista vazia também é gravada.

Se o Redis falhar na leitura ou na escrita durante a consulta, a falha é registrada e a busca segue para a AwesomeAPI. Se falhar na invalidação, a API responde 503.

## Rate limiting e timeout

A entrada permite 30 requisições por minuto para cada combinação de rota e IP. Acima disso, a resposta é 429. `GET /health` não consome esse limite.

A saída permite 5 chamadas por segundo dentro do processo. Geocoding e busca compartilham esse limite. Ele espera a permissão e só então inicia a chamada HTTP.

`AWESOME_API_TIMEOUT_MS` vale para cada chamada. O relógio começa depois que o limite de saída libera a permissão. A consulta completa pode passar de 5000 ms, porque cada página tem o próprio prazo. Uma chamada que estoura o tempo encerra a busca com 503. Um 429 da AwesomeAPI também vira 503.

## Precisão, cobertura e performance

O raio fixo de 1 km e as páginas de 10 itens mantêm a busca pequena. A paginação sequencial evita várias chamadas simultâneas à AwesomeAPI; em uma região com muitos CEPs, a resposta demora mais porque cada página espera a anterior e o limite de saída.

Haversine com esfera de 6371 km é suficiente para comparar distâncias de até 1 km. Ele não é o cálculo geodésico sobre o elipsoide.

O cache diminui chamadas externas. Até o TTL, a API pode devolver coordenada ou vizinhança já desatualizada no provedor. O conjunto final contém apenas CEPs presentes na resposta da AwesomeAPI.

## Limitações

- A cobertura depende da AwesomeAPI. A API não completa CEPs ausentes nessa resposta.
- `GET /health` informa que o processo está no ar. Ele não consulta Redis nem a AwesomeAPI.
- As rotas de invalidação não exigem autenticação.
- O limite de saída vale para uma instância. Réplicas não compartilham a mesma contagem.
- O Redis do Compose não tem volume nem senha. Os dados somem quando o container é removido.
- CEPs fora de `00000000` ou `00000-000` são rejeitados, sem tentativa de correção.

## Testes

```bash
npm test
npm run test:e2e
```

A suíte usa uma chave fictícia e não chama a AwesomeAPI.
