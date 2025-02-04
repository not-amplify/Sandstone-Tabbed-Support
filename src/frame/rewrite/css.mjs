import * as util from "../../util.mjs";
import * as network from "../network.mjs";
import { convert_url } from "../context.mjs";

const url_regex = /url\(['"]?(.+?)['"]?\)/gm;
const import_regex = /@import\s+(url\s*?\(.{0,9999}?\)|['"].{0,9999}?['"]|.{0,9999}?)($|\s|;)/gm;

export async function parse_css(css_str, css_url) {
  let matches = [...css_str.matchAll(url_regex)];
  let import_matches = [...css_str.matchAll(import_regex)];
  let requests = {};

  for (let match of matches) {
    let url = match[1];
    if (url.startsWith("data:") || url.startsWith("blob:")) continue;
    if (requests[url]) continue;

    requests[url] = (async () => {
      let absolute_url = convert_url(url, css_url);
      let response = await network.fetch(absolute_url);
      return [url, await response.blob()];
    })();
  }

  for (let match of import_matches) {
    let import_url = match[1].replace(/url\(['"]?|['"]?/g, "").replace(/["')]/g, "").trim();
    if (!import_url || import_url.startsWith("data:")) continue;
    if (requests[import_url]) continue;

    requests[import_url] = (async () => {
      let absolute_url = convert_url(import_url, css_url);
      let response = await network.fetch(absolute_url);
      return [import_url, await response.blob()]; // Store as a blob instead of inlining
    })();
  }

  if (!Object.keys(requests).length) {
    return replace_blobs(css_str, {});
  }

  let url_contents = await util.run_parallel(Object.values(requests));
  url_contents = url_contents.filter(item => item);
  if (!url_contents) return replace_blobs(css_str, {});
  let blobs = Object.fromEntries(url_contents);

  return replace_blobs(css_str, blobs);
}

function replace_blobs(css_str, blobs) {
  css_str = css_str.replaceAll(url_regex, (match, url) => {
    if (url.startsWith("data:") || url.startsWith("blob:")) {
      return match;
    }
    if (!blobs[url]) {
      return match;
    }
    let new_url = network.create_blob_url(blobs[url], url);
    return `url("${new_url}")`;
  });

  css_str = css_str.replaceAll(import_regex, (match, import_url) => {
    import_url = import_url.replace(/url\(['"]?|['"]?/g, "").replace(/["')]/g, "").trim();
    if (!blobs[import_url]) {
      return match;
    }
    let new_url = network.create_blob_url(blobs[import_url], import_url);
    return `@import url("${new_url}");`;
  });

  return css_str;
}
