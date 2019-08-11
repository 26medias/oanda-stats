# oanda-stats

A CLI offering trading stats based on your Oanda Forex account.

This is version `1.0.0`.

## Requirements

- Node 8+
- An OANDA account (only compatible with V20 accounts)

## Installation

`npm install oanda-stats`


## How to use

In you console, execute: `oanda-stats`

Enter the information on the console prompt:

- `OANDA ACCOUNT ID`: Your V20 account number [find it here](https://www.oanda.com/funding/)
- `OANDA API KEY`: Your API Key [find it here](https://www.oanda.com/account/tpa/personal_token)
- `Live API? (Y/n)`: Type `y` if the API key is a live account or `n` if it's a sandbox account
- `Refresh? (Y/n)`: Type `y` if you want to refresh your transaction history, or `n` to use the cache

Your browser will open and display charts and analytics about your trading account.

## How do I know you're not going to steal my API Key?

Your API key is saved locally in your OS's user directory, and is only sent to the Oanda API when refreshing your transaction list. There is no server or database receiving or storing your data. Everythign is saved & processed locally.

The code is open source, feel free to explore & modify it to your need.

## License: MIT