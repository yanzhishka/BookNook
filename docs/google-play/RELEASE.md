# Выпуск B.Nook в Google Play

## Готовая конфигурация

- package name: `io.github.yanzhishka.booknook`;
- минимальная версия Android: 7.0, API 24;
- target/compile SDK: API 36;
- формат публикации: Android App Bundle (`.aab`);
- текущая версия: `versionCode 1`, `versionName 1.0.0`;
- release-сборка подписывается локальным upload key;
- auth callback: `io.github.yanzhishka.booknook://auth/callback`;
- основной сайт: `https://book-nook-ten.vercel.app`.

Package name после создания приложения в Play Console менять нельзя.

## Сборка

1. Выполнить `npm run cap:sync` в корне проекта.
2. Использовать JDK 21 из Android Studio.
3. В каталоге `android` выполнить `./gradlew bundleRelease`.
4. Загрузить `android/app/build/outputs/bundle/release/app-release.aab` в Play Console.

Для следующего релиза увеличить обе версии:

```bash
./gradlew bundleRelease -PVERSION_CODE=2 -PVERSION_NAME=1.0.1
```

## Ключ подписи

Upload key и пароль хранятся только локально в игнорируемых Git файлах:

- `android/keystore/booknook-upload.jks`;
- `android/keystore.properties`.

Оба файла нужно сохранить вместе в надёжном зашифрованном резервном хранилище. Не добавлять их в Git и не передавать третьим лицам. При первом выпуске включить Play App Signing; этот ключ станет upload key.

## Поля Play Console

- Privacy policy: `https://book-nook-ten.vercel.app/privacy.html`
- Account deletion: `https://book-nook-ten.vercel.app/account-deletion.html`
- Terms: `https://book-nook-ten.vercel.app/terms.html`
- Community guidelines: `https://book-nook-ten.vercel.app/community-guidelines.html`
- Ads: No
- App access: часть функций доступна гостю, личные функции требуют аккаунт;
- Category: Books & Reference;
- Target audience: 13+;
- User-generated content: Yes;
- Content rating: указать публикации, комментарии, изображения и возможность жалоб/блокировки.

## Действия владельца Play Console

Выполняются вручную под аккаунтом разработчика: создать приложение с указанным package name, принять Play App Signing, добавить support email и child-safety contact, заполнить Data safety и content rating, загрузить графику/скриншоты, затем отправить сначала во внутреннее тестирование.
