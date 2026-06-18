import { getServer } from './dev-server.mjs';

export function ganntlensApi() {
  return {
    name: 'ganntlens-api',
    configureServer(server) {
      // 启动 dev-server（挂 5174 端口，配置 CORS）
      getServer();
    }
  };
}
