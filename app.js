const stocks = [
  { ticker: "SBER", name: "Сбербанк", price: 318.4, beta: 1.08, divYield: 0.11, future: "SBRF-9.26", lot: 100 },
  { ticker: "GAZP", name: "Газпром", price: 154.7, beta: 0.92, divYield: 0.08, future: "GAZR-9.26", lot: 100 },
  { ticker: "LKOH", name: "Лукойл", price: 7320, beta: 0.86, divYield: 0.10, future: "LKOH-9.26", lot: 10 },
  { ticker: "YDEX", name: "Яндекс", price: 4128, beta: 1.18, divYield: 0.0, future: "YDEX-9.26", lot: 10 },
  { ticker: "TATN", name: "Татнефть", price: 689.6, beta: 0.82, divYield: 0.13, future: "TATN-9.26", lot: 100 },
  { ticker: "GMKN", name: "Норникель", price: 128.9, beta: 0.78, divYield: 0.06, future: "GMKR-9.26", lot: 100 },
  { ticker: "ROSN", name: "Роснефть", price: 563.2, beta: 0.9, divYield: 0.09, future: "ROSN-9.26", lot: 100 },
  { ticker: "VTBR", name: "ВТБ", price: 94.2, beta: 1.25, divYield: 0.07, future: "VTBR-9.26", lot: 1000 },
];

const criteria = [
  { id: "drawdown", title: "Защита от больших просадок", hedgeRatio: 0.72, note: "Фокус на снижении убытка при падении рынка на 15-25%." },
  { id: "carry", title: "Дополнительный заработок от фандинга и контанго", hedgeRatio: 0.38, note: "Частичный хедж с выбором контрактов, где перенос позиции выгоднее." },
  { id: "cheap", title: "Минимальная стоимость хеджа", hedgeRatio: 0.45, note: "Больше фьючерсов, меньше дорогих опционов." },
  { id: "upside", title: "Сохранить рост портфеля", hedgeRatio: 0.52, note: "Опционы защищают вниз, но оставляют потенциал роста." },
  { id: "neutral", title: "Нейтрализовать бету к индексу", hedgeRatio: 0.82, note: "Основной риск гасится индексным фьючерсом MIX." },
];

const state = {
  positions: [],
  selectedCriterion: "drawdown",
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const tickerSelect = document.querySelector("#tickerSelect");
const quantityInput = document.querySelector("#quantityInput");
const portfolioList = document.querySelector("#portfolioList");
const positionCount = document.querySelector("#positionCount");
const portfolioValue = document.querySelector("#portfolioValue");
const portfolioBeta = document.querySelector("#portfolioBeta");
const portfolioYield = document.querySelector("#portfolioYield");
const criteriaList = document.querySelector("#criteriaList");
const recommendations = document.querySelector("#recommendations");
const resultTitle = document.querySelector("#resultTitle");
const riskBadge = document.querySelector("#riskBadge");
const app = document.querySelector("#app");
const chart = document.querySelector("#payoffChart");
const ctx = chart.getContext("2d");
const helpDialog = document.querySelector("#helpDialog");

function init() {
  tickerSelect.innerHTML = stocks
    .map((stock) => `<option value="${stock.ticker}">${stock.ticker} · ${stock.name} · ${money.format(stock.price)}</option>`)
    .join("");

  criteriaList.innerHTML = criteria
    .map(
      (item) => `
        <label class="criterion">
          <input type="radio" name="criterion" value="${item.id}" ${item.id === state.selectedCriterion ? "checked" : ""}>
          <span><b>${item.title}</b><br>${item.note}</span>
        </label>
      `,
    )
    .join("");

  document.querySelector("#startBtn").addEventListener("click", unlockApp);
  document.querySelector("#helpBtn").addEventListener("click", openHelp);
  document.querySelector("#helpBtnTop").addEventListener("click", openHelp);
  document.querySelector("#closeHelpBtn").addEventListener("click", () => helpDialog.close());
  document.querySelector("#addPositionBtn").addEventListener("click", addPosition);
  document.querySelector("#hedgeBtn").addEventListener("click", calculateHedge);
  document.querySelector("#leverageBtn").addEventListener("click", calculateLeverage);
  criteriaList.addEventListener("change", (event) => {
    state.selectedCriterion = event.target.value;
  });

  addPresetPortfolio();
  render();
  drawChart(0, 0);
}

function unlockApp() {
  app.classList.remove("is-locked");
  app.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openHelp() {
  if (typeof helpDialog.showModal === "function") {
    helpDialog.showModal();
  }
}

function addPresetPortfolio() {
  state.positions = [
    { ticker: "SBER", quantity: 300 },
    { ticker: "LKOH", quantity: 20 },
    { ticker: "YDEX", quantity: 15 },
  ];
}

function addPosition() {
  const ticker = tickerSelect.value;
  const quantity = Math.max(1, Number(quantityInput.value || 0));
  const existing = state.positions.find((position) => position.ticker === ticker);

  if (existing) {
    existing.quantity += quantity;
  } else {
    state.positions.push({ ticker, quantity });
  }

  render();
}

function removePosition(ticker) {
  state.positions = state.positions.filter((position) => position.ticker !== ticker);
  render();
}

function getStock(ticker) {
  return stocks.find((stock) => stock.ticker === ticker);
}

function totals() {
  const gross = state.positions.reduce((sum, position) => {
    const stock = getStock(position.ticker);
    return sum + stock.price * position.quantity;
  }, 0);

  if (!gross) {
    return { gross: 0, beta: 0, divYield: 0 };
  }

  const beta = state.positions.reduce((sum, position) => {
    const stock = getStock(position.ticker);
    const weight = (stock.price * position.quantity) / gross;
    return sum + stock.beta * weight;
  }, 0);

  const divYield = state.positions.reduce((sum, position) => {
    const stock = getStock(position.ticker);
    const weight = (stock.price * position.quantity) / gross;
    return sum + stock.divYield * weight;
  }, 0);

  return { gross, beta, divYield };
}

function render() {
  portfolioList.innerHTML = state.positions.length
    ? state.positions
        .map((position) => {
          const stock = getStock(position.ticker);
          const value = stock.price * position.quantity;
          return `
            <div class="position">
              <div>
                <strong>${stock.ticker} · ${stock.name}</strong>
                <span>${position.quantity} шт. × ${money.format(stock.price)}</span>
              </div>
              <strong>${money.format(value)}</strong>
              <button class="remove-btn" aria-label="Удалить ${stock.ticker}" data-remove="${stock.ticker}">×</button>
            </div>
          `;
        })
        .join("")
    : `<p class="empty">Портфель пуст.</p>`;

  portfolioList.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => removePosition(button.dataset.remove));
  });

  const total = totals();
  positionCount.textContent = `${state.positions.length} поз.`;
  portfolioValue.textContent = money.format(total.gross);
  portfolioBeta.textContent = total.beta.toFixed(2);
  portfolioYield.textContent = `${(total.divYield * 100).toFixed(1)}%`;
}

function selectedCriterion() {
  return criteria.find((item) => item.id === state.selectedCriterion);
}

function calculateHedge() {
  const total = totals();
  const criterion = selectedCriterion();

  if (!total.gross) {
    showEmptyResult();
    return;
  }

  const hedgeNotional = total.gross * criterion.hedgeRatio * Math.max(0.65, total.beta);
  const mixContract = 315000;
  const mixContracts = Math.max(1, Math.round(hedgeNotional / mixContract));
  const putBudget = criterion.id === "cheap" ? 0.008 : criterion.id === "upside" ? 0.025 : 0.016;
  const putPremium = total.gross * putBudget;
  const main = biggestPosition();
  const mainStock = getStock(main.ticker);
  const stockFutureNotional = mainStock.price * mainStock.lot;
  const stockFutureContracts = Math.max(1, Math.round((mainStock.price * main.quantity * 0.35) / stockFutureNotional));
  const drawdownBefore = total.gross * 0.2 * total.beta;
  const drawdownAfter = Math.max(0, drawdownBefore - hedgeNotional * 0.18 - putPremium * 2.4);
  const protection = Math.round((1 - drawdownAfter / drawdownBefore) * 100);

  resultTitle.textContent = "Рекомендация по хеджу";
  riskBadge.textContent = `${criterion.title}`;
  recommendations.innerHTML = [
    rec("sell", `Зашортить ${mixContracts} фьюч. MIX-9.26`, `Индексный хедж примерно на ${money.format(mixContracts * mixContract)}. Он снижает общий рыночный риск портфеля.`),
    rec("sell", `Зашортить ${stockFutureContracts} фьюч. ${mainStock.future}`, `Точечный хедж крупнейшей позиции ${mainStock.ticker}. Номинал около ${money.format(stockFutureContracts * stockFutureNotional)}.`),
    rec("buy", `Купить PUT на ${mainStock.ticker}`, `Бюджет премии: ${money.format(putPremium)}. Защита вниз сохраняет часть потенциала роста акции.`),
    rec("neutral", `Ожидаемый эффект`, `Снижение модельной просадки: ${protection}%. ГО и ликвидность нужно проверять по реальным данным биржи.`),
  ].join("");

  drawChart(drawdownBefore, drawdownAfter);
}

function calculateLeverage() {
  const total = totals();
  const criterion = selectedCriterion();

  if (!total.gross) {
    showEmptyResult();
    return;
  }

  const riskScale = {
    drawdown: 1.15,
    carry: 1.65,
    cheap: 1.35,
    upside: 1.25,
    neutral: 1.05,
  }[criterion.id];

  const stockShare = criterion.id === "carry" ? 0.55 : criterion.id === "upside" ? 0.68 : 0.48;
  const futureShare = criterion.id === "carry" ? 0.35 : criterion.id === "cheap" ? 0.42 : 0.28;
  const optionShare = Math.max(0.08, 1 - stockShare - futureShare);
  const targetNotional = total.gross * riskScale;

  resultTitle.textContent = "Оптимальные плечи";
  riskBadge.textContent = `целевой номинал ${riskScale.toFixed(2)}x`;
  recommendations.innerHTML = [
    rec("neutral", `Акции: ${(stockShare * 100).toFixed(0)}%`, `Держать базовый портфель на ${money.format(targetNotional * stockShare)} без дополнительного плеча.`),
    rec("sell", `Фьючерсы: ${(futureShare * 100).toFixed(0)}%`, `Использовать для дешевого плеча или хеджа. Ориентир ГО: ${money.format(targetNotional * futureShare * 0.14)}.`),
    rec("buy", `Опционы: ${(optionShare * 100).toFixed(0)}%`, `Ограничивают риск хвоста. Бюджет премий: ${money.format(targetNotional * optionShare * 0.09)}.`),
    rec("neutral", `Критерий подбора`, criterion.note),
  ].join("");

  drawChart(total.gross * 0.18 * total.beta, total.gross * 0.18 * total.beta * (1 - optionShare - futureShare * 0.55));
}

function biggestPosition() {
  return state.positions.reduce((largest, position) => {
    const currentValue = getStock(position.ticker).price * position.quantity;
    const largestValue = getStock(largest.ticker).price * largest.quantity;
    return currentValue > largestValue ? position : largest;
  }, state.positions[0]);
}

function rec(type, title, body) {
  return `
    <div class="rec ${type}">
      <strong>${title}</strong>
      <p>${body}</p>
    </div>
  `;
}

function showEmptyResult() {
  resultTitle.textContent = "Нужен портфель";
  recommendations.innerHTML = `<p class="empty">Добавьте хотя бы одну позицию.</p>`;
  drawChart(0, 0);
}

function drawChart(beforeLoss, afterLoss) {
  const width = chart.width;
  const height = chart.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, height);

  const padding = 36;
  const baseY = height - padding;
  const topY = padding;

  ctx.strokeStyle = "#d9cfc0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, baseY);
  ctx.lineTo(width - padding, baseY);
  ctx.moveTo(padding, topY);
  ctx.lineTo(padding, baseY);
  ctx.stroke();

  const points = [-25, -15, -5, 5, 15, 25];
  const maxLoss = Math.max(beforeLoss, afterLoss, 1);

  drawLine(points, (move) => -beforeLoss * (Math.abs(Math.min(move, 0)) / 25) + beforeLoss * 0.35 * Math.max(move, 0) / 25, "#b5312f");
  drawLine(points, (move) => -afterLoss * (Math.abs(Math.min(move, 0)) / 25) + beforeLoss * 0.22 * Math.max(move, 0) / 25, "#0f766e");

  ctx.fillStyle = "#6f675f";
  ctx.font = "14px Georgia";
  ctx.fillText("-25%", padding - 4, baseY + 22);
  ctx.fillText("рынок", width / 2 - 18, baseY + 22);
  ctx.fillText("+25%", width - padding - 28, baseY + 22);
  ctx.fillText("P/L", padding + 4, topY - 10);

  function x(index) {
    return padding + (index / (points.length - 1)) * (width - padding * 2);
  }

  function y(value) {
    const range = maxLoss * 1.25;
    return baseY - ((value + range) / (range * 2)) * (baseY - topY);
  }

  function drawLine(items, valueFn, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    items.forEach((item, index) => {
      const px = x(index);
      const py = y(valueFn(item));
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
}

init();
