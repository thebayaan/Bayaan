import 'expo-router/entry';
import {AppRegistry} from 'react-native';
import {
  CAR_KEEP_ALIVE_TASK,
  CAR_ROOT_COMPONENT,
  CarRoot,
  carKeepAliveTask,
} from './services/car/CarRoot';
// @ai-start
import {
  WIDGET_KEEP_ALIVE_TASK,
  WIDGET_ROOT_COMPONENT,
  WidgetRoot,
} from './services/widgets/WidgetRoot';
import {keepAliveTask} from './services/audio/BackgroundRoot';
// @ai-end

// Android Auto starts this headless root when the phone app is not open, and
// runs the keep-alive task while connected so JS timers keep running.
AppRegistry.registerComponent(CAR_ROOT_COMPONENT, () => CarRoot);
AppRegistry.registerHeadlessTask(CAR_KEEP_ALIVE_TASK, () => carKeepAliveTask);
// A widget tap with the app closed does the same until the tap is handled. // @ai
AppRegistry.registerComponent(WIDGET_ROOT_COMPONENT, () => WidgetRoot); // @ai
AppRegistry.registerHeadlessTask(WIDGET_KEEP_ALIVE_TASK, () => keepAliveTask); // @ai
