curl --request GET \
 --url 'https://pro-api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&names=Bitcoin&symbols=btc&category=layer-1&price_change_percentage=1h' \
 --header 'x-cg-pro-api-key: <api-key>'

## todo list

- 价格更新，价格显示动画
- 替换平台，封装自己的数据结构，方便后续不同平台的对接
  "id": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin", 币名字
  "image": "<https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400>", logo
  "market_cap_rank": 1, 排名
  "current_price": 70187, 当前价格
  "high_24h": 70215, 24小时最高价
  "low_24h": 68060, 24小时最低价
  price_change_percentage_24h 24小时涨跌
  ath 历史最高价
  "ath_change_percentage": -4.77063,
