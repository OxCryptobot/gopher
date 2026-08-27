# GOPHER AI

Paid phone assistant. Menus, selectors, fetch.

## Live

https://oxcryptobot.github.io/gopher/

## On the hole

- Numbered Gopher directory (add items in `HOLES` inside `app.js`)
- Prompt: type a selector, alias (`play`, `login`), or an order
- **FETCH/** — original 8-bit burrow game (selector `5`)
- **User/** — device login (selector `9`). Passphrases are PBKDF2-hashed in localStorage. Not a cloud account yet.

## Keys

`/` prompt · `1`–`9` menu · `0` / `esc` home · arrows in FETCH

## Local

```bash
python3 server.py
```

http://127.0.0.1:7070/
