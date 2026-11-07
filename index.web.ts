// из uzory: index.web.ts — изменено: без адреса папки сайта. Веб-сборка — стенд для сценария в браузере: Skia в браузере
// — CanvasKit, он грузится раньше приложения.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { registerRootComponent } from 'expo';

LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  registerRootComponent(require('./App').default);
});
