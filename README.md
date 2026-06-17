# B.Nook

Веб-приложение для чтения и обсуждения книг: личная библиотека, встроенная читалка с заметками, лента сообщества, форум-доска и профиль с системой опыта.

## Возможности

- **Библиотека** — добавление книг через поиск Open Library, отслеживание статуса и прогресса чтения.
- **Читалка** — полноэкранный режим чтения, настройки типографики (шрифт, кегль, интервал), темы оформления, дзен-режим и выделение фрагментов в заметки.
- **The Grid** — доска тредов с ответами и изображениями.
- **Лента** — публикация мыслей, цитат и прогресса; лайки и комментарии.
- **Профиль** — статистика чтения, опыт (XP) и уровни.
- **Оракул** *(опционально)* — рекомендации книг через Groq (Llama). Требует ключ `GROQ_API_KEY`.

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
services/                       — клиент Supabase, слой данных и поиск книг
supabase/schema.sql             — схема БД (выполнить в Supabase SQL Editor)
supabase/functions/book-proxy/  — Edge Function для импорта книг
```

## Настройка Supabase

1. Создай проект на [supabase.com](https://supabase.com) (бесплатно).
2. Открой **SQL Editor** и выполни содержимое [`supabase/schema.sql`](supabase/schema.sql).
3. В **Authentication → Sign In / Providers → Email** отключи «Confirm email»
   (чтобы регистрация сразу создавала сессию).
4. Задеплой Edge Function для импорта книг (нужен [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref <твой-project-ref>
   supabase functions deploy book-proxy
   ```
5. Скопируй ключи: **Project Settings → API** → `Project URL` и `anon public key`.

## Переменные окружения

Создай файл `.env` в корне проекта (см. [`.env.example`](.env.example)):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key

# опционально — для раздела «Оракул»
GROQ_API_KEY=your_groq_api_key
```

## Запуск

Требуется Node.js 18+.

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

> ⚠️ **Перед публикацией в Play Market:** вынеси вызов Groq из клиента (`Oracle.tsx`)
> в Supabase Edge Function — иначе `GROQ_API_KEY` попадёт в APK и его смогут извлечь.
> Anon-ключ Supabase в бандле — это нормально, его защищает RLS.
