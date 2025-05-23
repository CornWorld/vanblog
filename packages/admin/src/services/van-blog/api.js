import request from '@/utils/request';
import { encodeQuerystring } from './encode';
import { encryptPwd } from './encryptPwd';

export async function fetchAllMeta(options) {
  return request('/api/admin/meta', {
    method: 'GET',
    ...(options || {}),
  });
}

export async function fetchLatestVersionInfo() {
  return request('/api/admin/meta/upstream', {
    method: 'GET',
  });
}

export async function activeISR() {
  return request('/api/admin/isr', {
    method: 'POST',
  });
}
export async function getHttpsConfig() {
  return request('/api/admin/caddy/https', {
    method: 'GET',
  });
}
export async function getLoginConfig() {
  return request('/api/admin/setting/login', {
    method: 'GET',
  });
}
export async function updateLoginConfig(body) {
  return request('/api/admin/setting/login', {
    method: 'PUT',
    body: body,
  });
}
export async function getLayoutConfig() {
  return request('/api/admin/setting/layout', {
    method: 'GET',
  });
}
export async function updateLayoutConfig(body) {
  return request('/api/admin/setting/layout', {
    method: 'PUT',
    body: body,
  });
}
export async function getWalineConfig() {
  return request('/api/admin/setting/waline', {
    method: 'GET',
  });
}
export async function updateWalineConfig(body) {
  return request('/api/admin/setting/waline', {
    method: 'PUT',
    body: body,
  });
}
export async function getISRConfig() {
  return request('/api/admin/isr', {
    method: 'GET',
  });
}
export async function updateISRConfig(body) {
  return request('/api/admin/isr', {
    method: 'PUT',
    body: body,
  });
}
export async function clearCaddyLog() {
  return request('/api/admin/caddy/log', {
    method: 'DELETE',
  });
}
export async function getCaddyConfig() {
  return request('/api/admin/caddy/config', {
    method: 'GET',
  });
}
export async function getCaddyLog() {
  return request('/api/admin/caddy/log', {
    method: 'GET',
  });
}
export async function setHttpsConfig(data) {
  return request('/api/admin/caddy/https', {
    method: 'PUT',
    body: data,
  });
}

export async function fetchInit(body) {
  return request('/api/admin/init', {
    method: 'POST',
    body: body,
  });
}
export async function searchArtclesByLink(link) {
  return request('/api/admin/article/searchByLink', {
    method: 'POST',
    body: {
      link,
    },
  });
}
export async function scanImgsOfArticles() {
  return request('/api/admin/img/scan', {
    method: 'POST',
  });
}
export async function exportAllImgs() {
  return request('/api/admin/img/export', {
    method: 'POST',
  });
}

export async function login(body, options) {
  body.username = body.username.toLowerCase();
  body.password = encryptPwd(body.username, body.password);
  console.log(
    '[DEBUG] API login called with body structure:',
    JSON.stringify(
      {
        ...body,
        username: body.username,
        password: body.password,
      },
      null,
      2,
    ),
  );

  const payload = {
    username: body.username,
    password: body.password,
  };

  console.log(
    '[DEBUG] Sending login request with username:',
    payload.username,
    '(using pre-encrypted password)',
  );

  // 使用POST方法发送登录请求
  return request('/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
    ...(options || {}),
  });
}
export async function logout(options) {
  return request('/api/admin/auth/logout', {
    method: 'POST',
    ...(options || {}),
  });
}
export async function restore(data, options) {
  return request('/api/admin/auth/restore', {
    method: 'POST',
    data,
    ...(options || {}),
  });
}

export async function createArticle(body) {
  return request('/api/admin/article', {
    method: 'POST',
    body: body,
  });
}

export async function deleteArticle(id) {
  // ID can be numeric or a pathname (string)
  const encodedId = typeof id === 'string' ? encodeQuerystring(id) : id;
  return request(`/api/admin/article/${encodedId}`, {
    method: 'DELETE',
  });
}
export async function createCollaborator(body) {
  return request('/api/admin/collaborator', {
    method: 'POST',
    body: body,
  });
}
export async function createCustomPage(body) {
  return request('/api/admin/customPage', {
    method: 'POST',
    body: body,
  });
}
export async function createCustomFile(path, subPath) {
  return request(`/api/admin/customPage/file?path=${path}&subPath=${subPath}`, {
    method: 'POST',
  });
}
export async function createCustomFolder(path, subPath) {
  return request(`/api/admin/customPage/file?path=${path}&subPath=${subPath}`, {
    method: 'POST',
  });
}
export async function updateCustomPage(body) {
  return request('/api/admin/customPage', {
    method: 'PUT',
    body: body,
  });
}
export async function updateCustomPageFileInFolder(pathname, filePath, content) {
  return request('/api/admin/customPage/file', {
    method: 'PUT',
    body: {
      pathname,
      filePath,
      content,
    },
  });
}
export async function deleteCustomPageByPath(path) {
  return request('/api/admin/customPage?path=' + path, {
    method: 'DELETE',
  });
}
export async function getCustomPages() {
  return request('/api/admin/customPage/all', {
    method: 'GET',
  });
}
export async function getCustomPageByPath(path) {
  return request('/api/admin/customPage?path=' + path, {
    method: 'GET',
  });
}
export async function getCustomPageFolderTreeByPath(path) {
  return request('/api/admin/customPage/folder?path=' + path, {
    method: 'GET',
  });
}
export async function getCustomPageFileDataByPath(path, key) {
  return request('/api/admin/customPage/file?path=' + path + '&key=' + key, {
    method: 'GET',
  });
}
export async function updateCollaborator(body) {
  return request('/api/admin/collaborator', {
    method: 'PUT',
    body: body,
  });
}
export async function deleteCollaborator(id) {
  return request(`/api/admin/collaborator/${id}`, {
    method: 'DELETE',
  });
}
export async function getAllCollaborators() {
  return request(`/api/admin/collaborator`, {
    method: 'GET',
  });
}

export async function getAllCategories(withAllData = false) {
  return request(`/api/admin/category/all?detail=${withAllData ? 'true' : 'false'}`, {
    method: 'GET',
  });
}

export async function getArticlesByCategory(name) {
  return request(`/api/admin/category/${encodeQuerystring(name)}`, {
    method: 'GET',
  });
}

export async function getLog(type, page, pageSize = 10) {
  return request(`/api/admin/log?event=${type}&pageSize=${pageSize}&page=${page}`, {
    method: 'GET',
  });
}
export async function updateSiteInfo(body) {
  return request(`/api/admin/meta/site`, {
    method: 'PUT',
    body: body,
  });
}
export async function updateUser(body) {
  return request(`/api/admin/auth`, {
    method: 'PUT',
    body: body,
  });
}
export async function createCategory(body) {
  return request(`/api/admin/category/`, {
    method: 'POST',
    body: body,
  });
}
export async function updateCategory(name, value) {
  return request(`/api/admin/category/${encodeQuerystring(name)}`, {
    method: 'PUT',
    body: value,
  });
}
export async function updateTag(name, value) {
  return request(`/api/admin/tag/${name}?value=${value}`, {
    method: 'PUT',
  });
}
export async function deleteTag(name) {
  return request(`/api/admin/tag/${name}`, {
    method: 'DELETE',
  });
}
export async function deleteCategory(name) {
  return request(`/api/admin/category/${encodeQuerystring(name)}`, {
    method: 'DELETE',
  });
}
export async function deleteDraft(id) {
  return request(`/api/admin/draft/${id}`, {
    method: 'DELETE',
  });
}
export async function createDraft(body) {
  return request(`/api/admin/draft`, {
    method: 'POST',
    body: body,
  });
}
export async function publishDraft(id, body) {
  return request(`/api/admin/draft/publish?id=${id}`, {
    method: 'POST',
    body: body,
  });
}
export async function createDonate(body) {
  return request(`/api/admin/meta/reward`, {
    method: 'POST',
    body: body,
  });
}
export async function updateLink(body) {
  return request(`/api/admin/meta/link`, {
    method: 'PUT',
    body: body,
  });
}
export async function getLink() {
  return request(`/api/admin/meta/link`, {
    method: 'GET',
  });
}
export async function updateMenu(body) {
  return request(`/api/admin/meta/menu`, {
    method: 'PUT',
    body: body,
  });
}
export async function getMenu() {
  return request(`/api/admin/meta/menu`, {
    method: 'GET',
  });
}
export async function deleteLink(name) {
  return request(`/api/admin/meta/link/${name}`, {
    method: 'DELETE',
  });
}

export async function createLink(body) {
  return request(`/api/admin/meta/link`, {
    method: 'POST',
    body: body,
  });
}
export async function updateDonate(body) {
  return request(`/api/admin/meta/reward`, {
    method: 'PUT',
    body: body,
  });
}
export async function deleteDonate(name) {
  return request(`/api/admin/meta/reward/${name}`, {
    method: 'DELETE',
  });
}
export async function getDonate() {
  return request(`/api/admin/meta/reward`, {
    method: 'GET',
  });
}
export async function updateSocial(body) {
  return request(`/api/admin/meta/social`, {
    method: 'PUT',
    body: body,
  });
}
export async function getSocial() {
  return request(`/api/admin/meta/social`, {
    method: 'GET',
  });
}
export async function getSocialTypes() {
  return request(`/api/admin/meta/social/types`, {
    method: 'GET',
  });
}
export async function getTags() {
  return request(`/api/admin/tag/all`, {
    method: 'GET',
  });
}
export async function getAllCollaboratorsList() {
  return request(`/api/admin/collaborator/list`, {
    method: 'GET',
  });
}
export async function importAll() {
  return request(`/api/admin/backup/import`, {
    method: 'POST',
  });
}
export async function exportAll() {
  return request(`/api/admin/backup/export`, {
    method: 'GET',
    skipErrorHandler: true,
    responseType: 'blob',
  });
}
export async function deleteSocial(name) {
  return request(`/api/admin/meta/social/${name}`, {
    method: 'DELETE',
  });
}
export async function updateArticle(id, body) {
  // ID can be numeric or a pathname (string)
  const encodedId = typeof id === 'string' ? encodeQuerystring(id) : id;
  return request(`/api/admin/article/${encodedId}`, {
    method: 'PUT',
    body: body,
  });
}
export async function updateDraft(id, body) {
  return request(`/api/admin/draft/${id}`, {
    method: 'PUT',
    body: body,
  });
}
export async function updateAbout(body) {
  return request(`/api/admin/meta/about`, {
    method: 'PUT',
    body: body,
  });
}
export async function getAbout() {
  return request(`/api/admin/meta/about`, {
    method: 'GET',
  });
}
export async function getArticleById(id) {
  // ID can be numeric or a pathname (string)
  const encodedId = typeof id === 'string' ? encodeQuerystring(id) : id;
  return request(`/api/admin/article/${encodedId}`, {
    method: 'GET',
  });
}
export async function getDraftById(id) {
  return request(`/api/admin/draft/${id}`, {
    method: 'GET',
  });
}
export async function getSiteInfo() {
  return request(`/api/admin/meta/site`, {
    method: 'GET',
  });
}
export async function getArticlesByOption(option) {
  const newQuery = {};
  for (const [k, v] of Object.entries(option)) {
    newQuery[k] = v;
  }
  let queryString = '';
  for (const [k, v] of Object.entries(newQuery)) {
    queryString += `${k}=${v}&`;
  }
  queryString = queryString.substring(0, queryString.length - 1);
  return request(`/api/admin/article?${queryString}&toListView=true`, {
    method: 'GET',
  });
}
export async function getImgs(page, pageSize = 10) {
  return request(`/api/admin/img?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
  });
}
export async function deleteImgBySign(sign) {
  return request(`/api/admin/img/${sign}`, {
    method: 'DELETE',
  });
}
export async function deleteAllIMG() {
  return request(`/api/admin/img/all/delete`, {
    method: 'DELETE',
  });
}
export async function getStaticSetting() {
  return request(`/api/admin/setting/static`, {
    method: 'GET',
  });
}
export async function updateStaticSetting(data) {
  return request(`/api/admin/setting/static`, {
    method: 'PUT',
    body: data,
  });
}
export async function getDraftsByOption(option) {
  const newQuery = {};
  for (const [k, v] of Object.entries(option)) {
    newQuery[k] = v;
  }
  let queryString = '';
  for (const [k, v] of Object.entries(newQuery)) {
    queryString += `${k}=${v}&`;
  }
  queryString = queryString.substring(0, queryString.length - 1);
  return request(`/api/admin/draft?${queryString}&toListView=true`, {
    method: 'GET',
  });
}
export async function getWelcomeData(tab, overviewNum = 5, viewNum = 5, articleTabNum = 5) {
  return request(
    `/api/admin/analysis?tab=${tab}&viewerDataNum=${viewNum}&overviewDataNum=${overviewNum}&articleTabDataNum=${articleTabNum}`,
    {
      method: 'GET',
    },
  );
}
export async function getPiplelines() {
  return request(`/api/admin/pipeline`, {
    method: 'GET',
  });
}
export async function getPipelineConfig() {
  return request(`/api/admin/pipeline/config`, {
    method: 'GET',
  });
}
export async function getPipelineById(id) {
  return request(`/api/admin/pipeline/${id}`, {
    method: 'GET',
  });
}
export async function updatePipelineById(id, data) {
  return request(`/api/admin/pipeline/${id}`, {
    method: 'PUT',
    data,
  });
}
export async function deletePipelineById(id) {
  return request(`/api/admin/pipeline/${id}`, {
    method: 'DELETE',
  });
}
export async function createPipeline(data) {
  return request(`/api/admin/pipeline`, {
    method: 'POST',
    data,
  });
}
export async function triggerPipelineById(id, input) {
  return request(`/api/admin/pipeline/trigger/${id}`, {
    method: 'POST',
    body: input,
  });
}
export async function createApiToken(data) {
  return request(`/api/admin/token`, {
    method: 'POST',
    data,
  });
}
export async function deleteApiToken(id) {
  return request(`/api/admin/token/${id}`, {
    method: 'DELETE',
  });
}
export async function getAllApiTokens() {
  return request('/api/admin/token', {
    method: 'GET',
  });
}
