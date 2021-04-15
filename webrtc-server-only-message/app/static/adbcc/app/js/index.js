import {status, setOnlineList} from "./manager.js";
import * as api from "./api.js";
import * as modules from "./modules.js";
import * as draw from "./draw.js";

const init = async () => {
  draw.init();
  // connectJanus();
  let data = await api.getOnlineList(`https://${status.url}/f/api/v1/online`);
  setOnlineList(data);
  modules.routinelyUpdateOnlineList();
  console.log(status.online); 
  modules.drawOnlineList(status.online);
  modules.handleOnlineListOnClick(status.online, status.callState);
};

init();
