# Откуда файлы пробы

Всё, что лежит в `assets/` и `src/art/hall.gen.ts`: откуда, на каких правах, чем собрано. Тест
`tools/test/passport.test.ts` сверяет SHA-256 ниже с файлами: поменялся файл — поменяйте и строку.

## 1. Microsoft Rocketbox — люди

- **Автор:** Microsoft — библиотека Microsoft Rocketbox («Copyright (c) 2020 Microsoft»),
  https://github.com/microsoft/Microsoft-Rocketbox, коммит `0943055db6ec570bcef9f2c8b41c9e5467c808f9`.
- **Лицензия — MIT** (текст ниже, дословно).
- **Откуда файлы:** скопированы из `Nefeste/bolnitsa` (`assets/models/rocketbox/`, коммит `cd7f707`) как есть — там же
  записано, что изменено против набора (скелет сведён к 23 костям, упрощённая сетка, атлас 1024² WebP, убраны эмблемы
  и надписи) и как файлы собираются заново.

| Вид | Кто в пробе | SHA-256 `.glb` |
|---|---|---|
| `Medical_Male_03` | врач | `86fb2d10d9107fa0e343554e2a9e4f6056f35c91d73b19e91fd377fdc5776ca0` |
| `Medical_Female_01` | медсестра | `39b8ef82de7bb56c445ca857ef56594cde4692412e4aefa657ecdd62937fe055` |
| `Construction_Male_01` | рабочий в каске | `3c88f0fdda5168d8ecd63323dfd79447ba11433f47a39b48f0eff5238a1c8ce6` |
| `Business_Female_01` | служащая | `08083eb59f12a7e5ed488d2879664fb93680f032f80df0c46fcb126379c07559` |
| `Male_Adult_03` | пожилой пассажир | `a26cf7368fc54d0bcbebb6280458a785d3c58d0734be1a7db405b73e37dbd581` |
| `Female_Adult_02` | пожилая пассажирка | `62335e0a59d9e843201348df825bf46a3e2d34107173682aa9fef20d24f92fc8` |

```
MIT License

Copyright (c) 2020 Microsoft

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. Своё: из скриптов

| Файл | Чем собран | SHA-256 |
|---|---|---|
| `assets/models/hall.glb` | `blender/build.py`, Blender 4.5.15 | `1a69ab7b868727496c20bf5a14f0bcc63049230267ca3a5ad2b9d2565caf5f79` |
| `src/art/hall.gen.ts` | `blender/build.py`, Blender 4.5.15 | `a8593cbb811d84673ccb2183c82be05452a3859c0c51d0eec8ad3c349e6086ad` |
| `assets/people/people.bin` | `bun tools/people/pack.ts` — люди раздела 1, запечённые кодом «Больницы» | `40e9c8628286fca0965d15220a1136159041c8ea86cb961f9278395ac4f16930` |
| `assets/bake/hall.png` | `bun tools/bake/run.ts skia` — Three.js 0.184.0 в Chromium 1243 без окна (SwiftShader) | `8ecd8875cfe82fc5bae3877337c42bf4e8596dca93e108be3795a42a394130bf` |
| `assets/bake/people.png` | то же; люди раздела 1 | `ec2b3ecdeaa335798d5ffd1a0b4abec893c87c62d8a4fea86113cf9af318b8a3` |

Скрипты Blender и сборка людей повторяют файлы байт в байт. Запечённые картинки повторяются на той же версии Chromium;
на другой программный рендер может дать другие байты — тогда пересоберите и обновите строку.
