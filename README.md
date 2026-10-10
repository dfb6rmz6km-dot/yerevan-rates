Telegram Mini App для отслеживания курсов US / EUR / RUB в банках и обменниках Еревана
Данные с [Rate.am](https://www.rate.am), справочник точек — в редактируемом JSON

- Backend: Python 3.12 · FastAPI · Uvicorn · Pydantic · httpx + BeautifulSoup · Playwright (headless Chromium)
- Frontend: TypeScript · React 18 · Vite · Tailwind CSS · framer-motion · lucide-react
- Инфраструктура: Docker Compose (nginx раздаёт фронтенд и проксирует `/api` в бэкенд)

 Быстрый старт 

Нужен только Docker (с Compose v2.24+).

```bash
git clone https://github.com/<you>/yerevan-rates.git
cd yerevan-rates
docker compose up --build -d
```

Приложение: http://localhost:8080
АPI: http://localhost:8000/api/rates
Swagger: http://localhost:8000/docs

`.env` необязателен — без него используются значения по умолчанию. Чтобы что-то поменять (порты, интервал обновления):

```bash
cp .env.example .env   # отредактируйте и перезапустите: docker compose up -d
```

Первый парсинг запускается сразу после старта и занимает примерно 10–30 секунд (headless Chromium рендерит таблицы Rate.am).
Пока он идёт, приложение показывает демо-курсы из `exchange_points.json` и само переключится на живые данные.

Логи: `docker compose logs -f backend`

Бот с курсами в чате

Кнопка «Открыть приложение». Включается так — в `.env`:

```bash
BOT_TOKEN=123456:ABC...
WEBAPP_URL=https://rates.example.com
```

Как работает отказоустойчивость

1. Фоновая задача обновляет курсы каждые `REFRESH_INTERVAL_SECONDS` (по умолчанию 10 мин); ручной рефреш ограничен по частоте и не запускает параллельные парсинги (lock).
2. Сначала пробуется обычный HTTP-запрос, затем Playwright. Общий таймаут — `SCRAPE_TIMEOUT_SECONDS`.
3. Парсер ищет строки «название + ≥6 чисел» (USD/EUR/RUB × покупка/продажа) и проверяет каждое число на правдоподобность. Если Rate.am поменяет вёрстку, парсер вернёт «ничего», а не мусор — и сработает фоллбэк.
4. Любая ошибка ловится, логируется (`ERROR rates.service: Rate.am refresh failed, serving cached data: ...`) и отдаётся клиенту в поле `error`. Последний удачный снимок атомарно пишется в `rates_cache.json` и переживает перезапуск.
5. Фронтенд показывает источник данных и их возраст в шапке, при устаревших данных — предупреждение.