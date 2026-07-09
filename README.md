# TradeFlow

TradeFlow is a responsive frontend trading dashboard that provides a modern interface for monitoring market data, tracking a portfolio, and simulating stock trades. The application integrates live market data using the Finnhub API and presents it through an intuitive dashboard with interactive visualizations.

## Features

- Live stock price integration using the Finnhub API
- Interactive price charts powered by Chart.js
- Portfolio summary with profit and loss tracking
- Buy and sell order simulation
- Watchlist with live price updates
- Market overview dashboard
- Dark and light theme support
- Responsive user interface
- Local storage for portfolio persistence

## Tech Stack

- HTML5
- CSS3
- JavaScript (ES6)
- Chart.js
- Finnhub API

## Project Structure

```text
TradeFlow/
├── index.html
├── styles.css
├── app.js
├── config.example.js
└── .gitignore
```

## Getting Started

### Clone the repository

```bash
git clone https://github.com/Raj-Aryan111/TradeFlow.git
cd TradeFlow
```

### Configure the API Key

Create a file named `config.js` in the project root.

```javascript
const CONFIG = {
    FINNHUB_API_KEY: "YOUR_FINNHUB_API_KEY"
};
```

### Run the Project

Open the project using the Live Server extension in Visual Studio Code.

## Future Enhancements

- Historical price data for multiple timeframes
- Advanced portfolio analytics
- Stock news integration
- Multi-watchlist support
- Backend integration for user authentication and order management

## Author

Raj Aryan

GitHub: https://github.com/Raj-Aryan111
