// Точка входа на телефоне. В Hermes нет TextDecoder, а Three.js без него не работает — заплатка первой.
import 'fast-text-encoding';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
