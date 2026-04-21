# Token Holders Dashboard

Local single-page dashboard to analyze top holders of any token contract on ETH or BSC.

## Run

1. Install Node.js 18+.
2. Start server:
   - `npm start`
3. Open:
   - `http://localhost:3000`

## How To Use

1. Select chain (`ETH` or `BSC`).
2. Enter contract address (CA).
3. Click `Analyze`.

The app fetches top holders and classifies each row as:
- `Exchange - <name>`
- `Contract - <detail>`
- `Wallet/EOA`
