async function getOnlineList(url) {
  try {
    var requestOptions = {
      method: "GET",
      redirect: "follow",
    };

    let response = await fetch(url, requestOptions);
    let data = await response.json();
    let filterData = data.online.filter(x=> x.device_type=="hmd")
    return filterData;
  } catch (error) {
    console.log(error);
  }
}

export { getOnlineList };
