# B.Nook

Веб-приложение для чтения и обсуждения книг: личная библиотека, встроенная читалка с заметками, лента сообщества, форум-доска и профиль с системой опыта.

**Живой сайт:** https://book-nook-ten.vercel.app

## Возможности

- **Библиотека** — добавление книг через поиск Open Library, отслеживание статуса и прогресса чтения.
- **Читалка** — полноэкранный режим чтения, настройки типографики (шрифт, кегль, интервал), темы оформления, дзен-режим и выделение фрагментов в заметки.
- **The Grid** — доска тредов с ответами и изображениями.
- **Лента** — публикация мыслей, цитат и прогресса; лайки и комментарии.
- **Профиль** — статистика чтения, опыт (XP) и уровни.

## Технологии

- **Frontend:** React 18, TypeScript, Vite
- **Стили:** Tailwind CSS
- **Иконки:** lucide-react
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Поиск книг:** Supabase Edge Function — прокси к Open Library и Internet Archive

## Структура

```
App.tsx, index.tsx              — точка входа фронтенда
components/                     — экраны и UI-компоненты
services/                       — типизированный клиент Supabase и слой данных
services/database.types.ts      — типы, сгенерированные из production-схемы
supabase/migrations/            — воспроизводимая история миграций БД
supabase/schema.sql             — итоговая схема для справки/нового проекта
supabase/functions/book-proxy/  — Edge Function для импорта книг
```

## Настройка Supabase

1. Создай проект на [supabase.com](https://supabase.com) и установи
   [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Свяжи репозиторий с проектом и примени миграции:
   ```bash
   supabase login
   supabase link --project-ref <твой-project-ref>
   supabase db push
   ```
3. Задеплой Edge Function. JWT-проверка включена в `supabase/config.toml`,
   а внутри функции дополнительно проверяется реальный пользователь Supabase Auth:
   ```bash
   supabase functions deploy --project-ref <твой-project-ref>
   ```
4. В **Authentication → Sign In / Providers → Email** выбери нужный режим
   подтверждения почты. Интерфейс поддерживает оба варианта; для production
   подтверждение лучше оставить включённым. **Leaked Password Protection**
   доступен на тарифе Supabase Pro и выше.
5. Скопируй **Project URL** и publishable key (или legacy anon key) из
   **Project Settings → API**.

## Переменные окружения

Создай файл `.env` в корне проекта (см. [`.env.example`](.env.example)):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Для старых проектов вместо publishable key поддерживается legacy-ключ:

```bash
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

## Запуск

Требуется Node.js 20.19+ или 22.12+ (требование Vite 8).

```bash
npm install
npm run dev      # http://localhost:5173
```

## Сборка

```bash
npm run build      # проверка типов + сборка фронтенда в dist/
npm run preview    # предпросмотр собранной версии
```

## Android (Capacitor)

Приложение обёрнуто в нативный Android через [Capacitor](https://capacitorjs.com).
Тот же веб-код запускается в нативном WebView. Папка `android/` — нативный проект.

Требуется Android Studio (с Android SDK). Для сборки нужен **JDK 21** — он уже
встроен в Android Studio (JBR), поэтому проще всего собирать из неё.

```bash
# собрать веб, синхронизировать в android и открыть в Android Studio
npm run android
```

Далее в Android Studio: **Run ▶** на эмуляторе/устройстве, либо
**Build → Generate Signed Bundle / APK** для релиза в Play Market.

Сборка из терминала (минуя Android Studio) — укажи её JDK и SDK:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run cap:sync
./android/gradlew -p android assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Иконки и сплеш-экран генерируются из `assets/` командой:

```bash
npx @capacitor/assets generate --android
```

## Деплой сайта

Проект настроен как Vite-приложение на Vercel. Публичная production-конфигурация
хранится в `.env.production`, поэтому Git/Vercel deployment работает без ручной
настройки панели. Значения из **Project Settings → Environment Variables** можно
использовать как override для отдельных окружений; после их изменения обязательно
запусти новый deployment.

```bash
npm run build
# затем deploy через Git integration или Vercel CLI
```

Во фронтенде нет секретных ключей: publishable/anon key рассчитан на публичное
использование вместе с RLS и минимальными grants.
