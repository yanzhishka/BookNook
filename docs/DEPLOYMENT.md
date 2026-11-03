# Публикация

Сайт: **https://milliardarmedia.ru**. Адрес `www.milliardarmedia.ru` перенаправляет на основной домен.

## Cloudflare Pages

- Проект: `nook-milliardarmedia`.
- Технический адрес для проверки независимо от основного домена: https://nook-milliardarmedia.pages.dev.
- Перенаправление `www` → основной домен настроено в зоне Cloudflare правилом `Nook canonical domain` (301, с сохранением пути и query string). Pages `_redirects` не поддерживает домен в исходном адресе.
- Репозиторий: `yanzhishka/BookNook`, production-ветка `main`.
- Команда сборки: `npm test && npm run build`.
- Результат: `dist`, Node.js — из `.node-version`.
- Настройки клиентского Supabase находятся в `.env.production`: только публичный URL и publishable key. Секретные серверные ключи в клиентскую сборку не добавляются.
- После push в `main` GitHub Actions проверяет проект и вызывает deploy hook ветки `main`. Pages собирает новую версию. Если проверки не пройдут, остаётся предыдущая публикация. Логи доступны в Cloudflare Workers & Pages → nook-milliardarmedia → Deployments.
- Hook `GitHub main after checks` хранится только в GitHub Actions secret `CLOUDFLARE_PAGES_DEPLOY_HOOK`. Он запускает сборку одного проекта из `main`; общий API-токен Cloudflare не используется. Для ротации создайте новый hook в Settings → Builds и замените secret, затем удалите старый hook.
- Автоматический запуск через native Git integration отключён: публикацию запускает CI после проверок. Это также исключает двойные сборки, если права GitHub-приложения Cloudflare изменятся.

Внешний backend остаётся в существующем Supabase-проекте. SQL-миграции не запускаются автоматически при сборке фронтенда. Миграции до `20261103101602_extend_watch_player` уже применены.

## Релизы

GitHub Actions проверяет pull request и push в `main` / `codex/**`. Для выпуска обновите версию в `package.json` и lockfile, при необходимости добавьте `docs/releases/vX.Y.Z.md`, затем создайте и отправьте соответствующий тег `vX.Y.Z`.

Workflow `Publish release` проверяет совпадение тега и версии, запускает тесты и сборку, создаёт GitHub Release и прикрепляет `nook-web.tar.gz`. Для него достаточно встроенного `GITHUB_TOKEN`; постоянный токен Cloudflare в GitHub не нужен. Домен обслуживает последний успешный деплой `main`, а релизы фиксируют конкретные версии для скачивания и отката.

## Откат

Для отката Nook выберите предыдущую успешную публикацию в Cloudflare Pages и выполните Rollback. Затем откатите соответствующий коммит в `main`, чтобы следующий push не вернул проблемную версию.

Прежний новостной проект `milliardarmedia` и его репозиторий сохранены. Он остаётся доступен по адресу `milliardarmedia.pages.dev`. Для возврата новостного сайта отсоедините домены от `nook-milliardarmedia`, подключите их обратно к `milliardarmedia` и верните обе CNAME-записи на `milliardarmedia.pages.dev`.
