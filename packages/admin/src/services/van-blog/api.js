import request from '@/utils/request';
import { encodeQuerystring } from './encode';
import { encryptPwd } from './encryptPwd';

export async function fetchAllMeta(options) {
  return request('/api/v2/public/bootstrap', {
    method: 'GET',
    ...(options || {}),
  });
}

export async function fetchLatestVersionInfo() {
  return request('/api/v2/admin/meta/version', {
    method: 'GET',
  });
}

export async function activeISR() {
  return request('/api/v2/admin/isr/trigger', {
    method: 'POST',
  });
}
export async function getHttpsConfig() {
  return request('/api/v2/admin/settings/https', {
    method: 'GET',
  });
}
export async function getLoginConfig() {
  return request('/api/v2/admin/settings/login', {
    method: 'GET',
  });
}
export async function updateLoginConfig(body) {
  return request('/api/v2/admin/settings/login', {
    method: 'PUT',
    body: body,
  });
}
export async function getLayoutConfig() {
  return request('/api/v2/admin/settings/layout', {
    method: 'GET',
  });
}
export async function updateLayoutConfig(body) {
  return request('/api/v2/admin/settings/layout', {
    method: 'PUT',
    body: body,
  });
}
export async function getWalineConfig() {
  return request('/api/v2/admin/settings/waline', {
    method: 'GET',
  });
}
export async function updateWalineConfig(body) {
  return request('/api/v2/admin/settings/waline', {
    method: 'PUT',
    body: body,
  });
}
export async function getISRConfig() {
  return request('/api/v2/admin/isr/config', {
    method: 'GET',
  });
}
export async function updateISRConfig(body) {
  return request('/api/v2/admin/isr/config', {
    method: 'PUT',
    body: body,
  });
}
export async function clearCaddyLog() {
  return request('/api/v2/admin/caddy/logs', {
    method: 'DELETE',
  });
}
export async function getCaddyConfig() {
  return request('/api/v2/admin/caddy/config', {
    method: 'GET',
  });
}
export async function getCaddyLog() {
  return request('/api/v2/admin/caddy/logs', {
    method: 'GET',
  });
}
export async function setHttpsConfig(data) {
  return request('/api/v2/admin/settings/https', {
    method: 'PUT',
    body: data,
  });
}

export async function fetchInit(body) {
  return request('/api/v2/public/init', {
    method: 'POST',
    body: body,
  });
}
export async function searchArtclesByLink(link) {
  return request(`/api/v2/admin/articles/search?link=${encodeQuerystring(link)}`, {
    method: 'GET',
  });
}
export async function scanImgsOfArticles() {
  return request('/api/v2/admin/media/scan-articles', {
    method: 'POST',
  });
}
export async function exportAllImgs() {
  return request('/api/v2/admin/media/export/all', {
    method: 'GET',
  });
}

export async function login(body, options) {
  return request('/api/v2/auth/login', {
    method: 'POST',
    body: {
      username: body.name,
      password: encryptPwd(body.password),
    },
    ...(options || {}),
  });
}
export async function logout(options) {
  return request('/api/v2/auth/logout', {
    method: 'POST',
    ...(options || {}),
  });
}
export async function restore(data, options) {
  return request('/api/v2/admin/backup/restore', {
    method: 'POST',
    body: data,
    ...(options || {}),
  });
}

export async function createArticle(body) {
  return request('/api/v2/admin/articles', {
    method: 'POST',
    body: body,
  });
}

export async function deleteArticle(id) {
  return request(`/api/v2/admin/articles/${id}`, {
    method: 'DELETE',
  });
}
export async function createCollaborator(body) {
  return request('/api/v2/admin/users/collaborators', {
    method: 'POST',
    body: body,
  });
}
export async function createCustomPage(body) {
  return request('/api/v2/admin/custom-pages', {
    method: 'POST',
    body: body,
  });
}
export async function createCustomFile(path, subPath) {
  return request(`/api/v2/admin/custom-pages/file?path=${path}&subPath=${subPath}`, {
    method: 'POST',
  });
}
export async function createCustomFolder(path, subPath) {
  return request(`/api/v2/admin/custom-pages/file?path=${path}&subPath=${subPath}`, {
    method: 'POST',
  });
}
export async function updateCustomPage(body) {
  return request('/api/v2/admin/custom-pages', {
    method: 'PUT',
    body: body,
  });
}
export async function updateCustomPageFileInFolder(pathname, filePath, content) {
  return request('/api/v2/admin/custom-pages/file', {
    method: 'PUT',
    body: {
      pathname,
      filePath,
      content,
    },
  });
}
export async function deleteCustomPageByPath(path) {
  return request('/api/v2/admin/custom-pages?path=' + path, {
    method: 'DELETE',
  });
}
export async function getCustomPages() {
  return request('/api/v2/admin/custom-pages/all', {
    method: 'GET',
  });
}
export async function getCustomPageByPath(path) {
  return request('/api/v2/admin/custom-pages?path=' + path, {
    method: 'GET',
  });
}
export async function getCustomPageFolderTreeByPath(path) {
  return request('/api/v2/admin/custom-pages/folder?path=' + path, {
    method: 'GET',
  });
}
export async function getCustomPageFileDataByPath(path, key) {
  return request('/api/v2/admin/custom-pages/file?path=' + path + '&key=' + key, {
    method: 'GET',
  });
}
export async function updateCollaborator(body) {
  return request('/api/v2/admin/users/collaborators', {
    method: 'PUT',
    body: body,
  });
}
export async function deleteCollaborator(id) {
  return request(`/api/v2/admin/users/collaborators/${id}`, {
    method: 'DELETE',
  });
}
export async function getAllCollaborators() {
  return request(`/api/v2/admin/users/collaborators`, {
    method: 'GET',
  });
}

export async function getAllCategories(withAllData = false) {
  return request(`/api/v2/admin/categories?detail=${withAllData ? 'true' : 'false'}`, {
    method: 'GET',
  });
}

export async function getArticlesByCategory(name) {
  return request(`/api/v2/admin/categories/${encodeQuerystring(name)}/articles`, {
    method: 'GET',
  });
}

export async function getLog(type, page, pageSize = 10) {
  return request(`/api/v2/admin/analytics/logs?event=${type}&pageSize=${pageSize}&page=${page}`, {
    method: 'GET',
  });
}
export async function updateSiteInfo(body) {
  return request(`/api/v2/admin/settings/site-info`, {
    method: 'PUT',
    body: body,
  });
}
export async function updateUser(body) {
  return request(`/api/v2/admin/users/profile`, {
    method: 'PUT',
    body: body,
  });
}
export async function createCategory(body) {
  return request(`/api/v2/admin/categories`, {
    method: 'POST',
    body: body,
  });
}
export async function updateCategory(name, value) {
  return request(`/api/v2/admin/categories/${encodeQuerystring(name)}`, {
    method: 'PUT',
    body: value,
  });
}
export async function updateTag(name, value) {
  return request(`/api/v2/admin/tags/${encodeQuerystring(name)}`, {
    method: 'PUT',
    body: value,
  });
}
export async function deleteTag(name) {
  return request(`/api/v2/admin/tags/${encodeQuerystring(name)}`, {
    method: 'DELETE',
  });
}
export async function deleteCategory(name) {
  return request(`/api/v2/admin/categories/${encodeQuerystring(name)}`, {
    method: 'DELETE',
  });
}
export async function deleteDraft(id) {
  return request(`/api/v2/admin/drafts/${id}`, {
    method: 'DELETE',
  });
}
export async function createDraft(body) {
  return request(`/api/v2/admin/drafts`, {
    method: 'POST',
    body: body,
  });
}
export async function publishDraft(id, body) {
  return request(`/api/v2/admin/drafts/${id}/publish`, {
    method: 'POST',
    body: body,
  });
}
export async function createDonate(body) {
  return request(`/api/v2/admin/settings/donations`, {
    method: 'POST',
    body: body,
  });
}
export async function updateLink(body) {
  return request(`/api/v2/admin/settings/friend-links`, {
    method: 'PUT',
    body: body,
  });
}
export async function getLink() {
  return request(`/api/v2/admin/settings/friend-links`, {
    method: 'GET',
  });
}
export async function updateMenu(body) {
  return request(`/api/v2/admin/settings/navigation`, {
    method: 'PUT',
    body: body,
  });
}
export async function getMenu() {
  return request(`/api/v2/admin/settings/navigation`, {
    method: 'GET',
  });
}
export async function deleteLink(name) {
  return request(`/api/v2/admin/settings/friend-links/${encodeQuerystring(name)}`, {
    method: 'DELETE',
  });
}

export async function createLink(body) {
  return request(`/api/v2/admin/settings/friend-links`, {
    method: 'POST',
    body: body,
  });
}
export async function updateDonate(body) {
  return request(`/api/v2/admin/settings/donations`, {
    method: 'PUT',
    body: body,
  });
}
export async function deleteDonate(name) {
  return request(`/api/v2/admin/settings/donations/${encodeQuerystring(name)}`, {
    method: 'DELETE',
  });
}
export async function getDonate() {
  return request(`/api/v2/admin/settings/donations`, {
    method: 'GET',
  });
}
export async function updateSocial(body) {
  return request(`/api/v2/admin/settings/social`, {
    method: 'PUT',
    body: body,
  });
}
export async function getSocial() {
  return request(`/api/v2/admin/settings/social`, {
    method: 'GET',
  });
}
export async function getSocialTypes() {
  return request(`/api/v2/admin/settings/social/types`, {
    method: 'GET',
  });
}
export async function getTags() {
  return request(`/api/v2/admin/tags`, {
    method: 'GET',
  });
}
export async function getAllCollaboratorsList() {
  return request(`/api/v2/admin/users/collaborators`, {
    method: 'GET',
  });
}
export async function importAll() {
  return request(`/api/v2/admin/backup/import`, {
    method: 'POST',
  });
}
export async function exportAll() {
  return request(`/api/v2/admin/backup/export`, {
    method: 'GET',
  });
}
export async function deleteSocial(name) {
  return request(`/api/v2/admin/settings/social/${encodeQuerystring(name)}`, {
    method: 'DELETE',
  });
}
export async function updateArticle(id, body) {
  return request(`/api/v2/admin/articles/${id}`, {
    method: 'PUT',
    body: body,
  });
}
export async function updateDraft(id, body) {
  return request(`/api/v2/admin/drafts/${id}`, {
    method: 'PUT',
    body: body,
  });
}
export async function updateAbout(body) {
  return request(`/api/v2/admin/settings/about`, {
    method: 'PUT',
    body: body,
  });
}
export async function getAbout() {
  return request(`/api/v2/admin/settings/about`, {
    method: 'GET',
  });
}
export async function getArticleById(id) {
  return request(`/api/v2/admin/articles/${id}`, {
    method: 'GET',
  });
}
export async function getDraftById(id) {
  return request(`/api/v2/admin/drafts/${id}`, {
    method: 'GET',
  });
}
export async function getSiteInfo() {
  return request(`/api/v2/admin/settings/site-info`, {
    method: 'GET',
  });
}
export async function getArticlesByOption(option) {
  return request(
    `/api/v2/admin/articles?${new URLSearchParams({
      page: option.current || 1,
      pageSize: option.pageSize || 10,
      ...(option.category && { category: option.category }),
      ...(option.tag && { tag: option.tag }),
      ...(option.topping !== undefined && { topping: option.topping }),
      ...(option.hidden !== undefined && { hidden: option.hidden }),
      ...(option.password !== undefined && { password: option.password }),
    })}`,
    {
      method: 'GET',
    },
  );
}
export async function getImgs(page, pageSize = 10) {
  return request(`/api/v2/admin/media?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
  });
}
export async function deleteImgBySign(sign) {
  return request(`/api/v2/admin/media/${sign}`, {
    method: 'DELETE',
  });
}
export async function deleteAllIMG() {
  return request(`/api/v2/admin/media/batch-delete`, {
    method: 'POST',
  });
}
export async function getStaticSetting() {
  return request(`/api/v2/admin/media/storage-config`, {
    method: 'GET',
  });
}
export async function updateStaticSetting(data) {
  return request(`/api/v2/admin/media/storage-config`, {
    method: 'POST',
    body: data,
  });
}
export async function getDraftsByOption(option) {
  return request(
    `/api/v2/admin/drafts?${new URLSearchParams({
      page: option.current || 1,
      pageSize: option.pageSize || 10,
      ...(option.category && { category: option.category }),
      ...(option.tag && { tag: option.tag }),
    })}`,
    {
      method: 'GET',
    },
  );
}
export async function getWelcomeData(tab, overviewNum = 5, viewNum = 5, articleTabNum = 5) {
  return request(
    `/api/v2/admin/analytics/overview?tab=${tab}&overviewNum=${overviewNum}&viewNum=${viewNum}&articleTabNum=${articleTabNum}`,
    {
      method: 'GET',
    },
  );
}
export async function getPiplelines() {
  return request(`/api/v2/admin/pipelines`, {
    method: 'GET',
  });
}
export async function getPipelineConfig() {
  return request(`/api/v2/admin/pipelines/config`, {
    method: 'GET',
  });
}
export async function getPipelineById(id) {
  return request(`/api/v2/admin/pipelines/${id}`, {
    method: 'GET',
  });
}
export async function updatePipelineById(id, data) {
  return request(`/api/v2/admin/pipelines/${id}`, {
    method: 'PUT',
    body: data,
  });
}
export async function deletePipelineById(id) {
  return request(`/api/v2/admin/pipelines/${id}`, {
    method: 'DELETE',
  });
}
export async function createPipeline(data) {
  return request(`/api/v2/admin/pipelines`, {
    method: 'POST',
    body: data,
  });
}
export async function triggerPipelineById(id, input) {
  return request(`/api/v2/admin/pipelines/${id}/trigger`, {
    method: 'POST',
    body: input,
  });
}
export async function createApiToken(data) {
  return request(`/api/v2/admin/tokens`, {
    method: 'POST',
    body: data,
  });
}
export async function deleteApiToken(id) {
  return request(`/api/v2/admin/tokens/${id}`, {
    method: 'DELETE',
  });
}
export async function getAllApiTokens() {
  return request(`/api/v2/admin/tokens`, {
    method: 'GET',
  });
}
