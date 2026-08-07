# Fideliza+ Mobile

Aplicativo Expo/React Native para os três perfis do Fideliza+.

| Perfil | Fluxos incluídos |
| --- | --- |
| Cliente | confirmação por código, cartão, selos, sorteios e prêmios |
| Administrador/dono | indicadores, campanhas, clientes, equipe e configurações |
| Funcionário | consulta de clientes, lançamento de compra e entrega de prêmio |

## Rodar localmente

```bash
cp .env.example .env
npm install
npm run android
```

No emulador Android, mantenha `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`.
Em aparelho físico, troque pelo IP LAN da máquina que executa a API.

## Reconhecimento facial

O app usa a câmera nativa do Expo e executa TensorFlow.js/Human em um WebView
local. Ele envia ao backend somente o descritor FaceRes compatível com o painel
web; a foto capturada fica na memória durante a análise e não é armazenada.

Em desenvolvimento, os modelos são carregados do CDN indicado em
`EXPO_PUBLIC_HUMAN_BASE_URL`. Em produção, publique a mesma versão do pacote
Human em infraestrutura própria e altere essa variável para a URL publicada.

## Verificações

```bash
npm run typecheck
npm run export:android
```

## Segurança antes da distribuição

O backend atual ainda identifica administrador e funcionário pelos cabeçalhos
`X-Usuario-Id` e `X-Empresa-Id`. Eles permitem desenvolvimento local, mas não
devem ser usados para distribuir o app. A API precisa emitir e validar tokens
assinados (JWT ou sessão equivalente) antes de uma publicação em lojas.
# fideliza-mobile
# fideliza-mobile
