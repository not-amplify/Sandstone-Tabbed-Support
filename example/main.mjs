import * as sandstone from "../dist/sandstone.mjs";

const from_id = (id) => document.getElementById(id);
let tabIndex = 0;

const navigate_button = from_id("navigate_button");
const url_box = from_id("url_box");
const frame_container = from_id("frame_container");
const version_text = from_id("version_text");
const options_button = from_id("options_button");
const options_div = from_id("options_div");
const wisp_url_input = from_id("wisp_url_input");
const home_url_input = from_id("home_url_input");
const close_options_button = from_id("close_options_button");
const eval_js_input = from_id("eval_js_input");
const eval_js_button = from_id("eval_js_button");
const add_tab = from_id("add_tab");
const tabsContainer = from_id("tabs")

class Tabs {
  constructor() {
    this.tabFrames = new Map();
    window.tabs = this;
  }

  async createTab() {
    const newTabId = "tab-" + tabIndex;
    const newContentId = "iframe-" + tabIndex;

    let newTab = document.createElement("div");
    newTab.classList.add("tab");
    newTab.id = newTabId;
    newTab.draggable = false;

    let newFavicon = document.createElement("img");
    newFavicon.classList.add("favicon");
    newFavicon.setAttribute("src", (document.querySelector("link[rel='icon']").href))
    newTab.appendChild(newFavicon);

    let newTitle = document.createElement("span");
    newTitle.classList.add("title");
    newTitle.textContent = "New Tab";
    newTab.appendChild(newTitle);

    let closeButton = document.createElement("button");
    closeButton.classList.add("close-tab");
    closeButton.textContent = "X";
    closeButton.onclick = function (event) {
      newTab.remove();
      newIframe.remove();
      tabs.tabFrames.delete(newTabId);
      event.stopPropagation();
    };
    newTab.appendChild(closeButton);
    tabsContainer.appendChild(newTab);

    // Create the iframe within the content pane
    let newIframe = document.createElement("iframe");
    newIframe.setAttribute("id", newContentId);
    frame_container.appendChild(newIframe);

    const main_frame = new sandstone.controller.ProxyFrame(newIframe);
    this.tabFrames.set(newTabId, main_frame);

    const homePage = localStorage.getItem("homeURL") || "https://start.duckduckgo.com"

    main_frame.navigate_to(homePage);

    main_frame.on_navigate = () => {
      if (newTab.classList.contains("active")) {
        url_box.value = main_frame.url.href;
      }
    };

    main_frame.on_load = async () => {
      if (newTab.classList.contains("active")) {
        url_box.value = main_frame.url.href;
        let favicon_url = await main_frame.get_favicon();
        if (!favicon_url.startsWith("data:")) {
          let response = await sandstone.libcurl.fetch(favicon_url);
          if (!response.ok) return;
          let favicon = await response.blob();
          favicon_url = URL.createObjectURL(favicon);
        }
        newFavicon.src = favicon_url;

        let title = main_frame.iframe.contentWindow.document.head.querySelector("title").textContent;
        const cutTitle = title.slice(0, 10);
        newTitle.textContent = cutTitle;
        newTitle.title = title;
      }
    };

    main_frame.on_url_change = () => {
      if (newTab.classList.contains("active")) {
        url_box.value = main_frame.url.href;
      }
    };

    newTab.addEventListener("click", () => {
      document.querySelectorAll(".tab, iframe").forEach((el) => {
        el.classList.remove("active");
      });
      newTab.classList.add("active");
      newIframe.classList.add("active");
      url_box.value = main_frame.url.href;
    });

    newTab.click();

    tabIndex++;
  }

  getActiveFrame() {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return null;
    return this.tabFrames.get(activeTab.id);
  }

  search(input) {
    input = input.trim();
    const searchTemplate = localStorage.getItem("engine") || "https://duckduckgo.com/?q=%s";

    try {
      return new URL(input).toString();
    } catch (err) {
      try {
        const url = new URL(`http://${input}`);
        if (url.hostname.includes(".")) {
          return url.toString();
        }
        throw new Error("Invalid hostname");
      } catch (err) {
        return searchTemplate.replace("%s", encodeURIComponent(input));
      }
    }
  }

  async navigate_clicked() {
    let activeFrame = this.getActiveFrame();
    if (activeFrame) {
      await activeFrame.navigate_to(this.search(url_box.value));
    }
  }

  toggle_options() {
    options_div.style.display = options_div.style.display === "none" ? "flex" : "none";
    frame_container.style.filter = frame_container.style.filter ? "" : "brightness(50%)";

    sandstone.libcurl.set_websocket(wisp_url_input.value);
  }


  async main() {
    if (location.hash) url_box.value = location.hash.substring(1);

    let wisp_url = (localStorage.getItem("wisp")) || "wss://wisp.mercurywork.shop/";
    if (location.protocol !== "http:" && location.protocol !== "https:") {
      sandstone.libcurl.set_websocket(wisp_url);
    } else {
      wisp_url = location.origin.replace("http", "ws");
      sandstone.libcurl.set_websocket(wisp_url);
    }

    version_text.textContent = `v${sandstone.version.ver} (${sandstone.version.hash})`;
    wisp_url_input.value = wisp_url;
    home_url_input.value = localStorage.getItem("homeURL") || "https://start.duckduckgo.com"
    options_button.onclick = () => this.toggle_options();
    close_options_button.onclick = () => this.toggle_options();

    document.body.onkeydown = (event) => {
      if (event.key !== "Escape") return;
      if (options_div.style.display === "none") return;
      this.toggle_options();
    };

    eval_js_button.onclick = () => {
      let activeFrame = this.getActiveFrame();
      if (activeFrame) {
        activeFrame.eval_js(eval_js_input.value);
      }
    };

    navigate_button.onclick = () => this.navigate_clicked();
    url_box.onkeydown = (event) => {
      if (event.code === "Enter") {
        this.navigate_clicked();
      }
    };
    await this.navigate_clicked();

    const searchSwitcher = from_id("search_select");
    searchSwitcher.value = localStorage.getItem("engine");

    searchSwitcher.addEventListener("change", () => {
      localStorage.setItem("engine", searchSwitcher.value);
    })

    wisp_url_input.addEventListener("keydown", (e) => {
      if (e.key == "Enter") {
        localStorage.setItem("wisp", wisp_url_input.value);
      }
      sandstone.libcurl.set_websocket((localStorage.getItem("wisp")) || "wss://wisp.mercurywork.shop/")
    })

    home_url_input.addEventListener("keydown", (e) => {
      if (e.key == "Enter") {
        localStorage.setItem("homeURL", home_url_input.value);
      }
    })

    add_tab.onclick = () => { this.createTab(); }
    this.createTab();

    frame_container.style.backgroundColor = "unset";
  }
}

const tabs = new Tabs();
tabs.main();
