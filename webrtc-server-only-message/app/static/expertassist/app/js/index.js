import { isProduction, status, setOnlineList } from "./manager.js";
import * as api from "./api.js";
import * as modules from "./modules.js";
import * as draw from "./draw.js";

const init = async () => {
  draw.init();
  // connectJanus();
  let onlineURL = isProduction
    ? `https://${status.url}/f/api/v1/online`
    : `http://${status.url}:5000/api/v1/online`;
  let data = await api.getOnlineList(onlineURL);
  setOnlineList(data);
  modules.routinelyUpdateOnlineList();
  console.log(status.online);
  modules.drawOnlineList(status.online);
  modules.handleOnlineListOnClick(status.online, status.callState);
  modules.handleSettingBtnOnclick();
};

init();
