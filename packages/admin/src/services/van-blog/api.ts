/* eslint-disable @typescript-eslint/no-explicit-any */
import { settingService } from './setting';
import { authService } from './auth';
import { userService } from './user';
import { categoryService } from './category';
import { tagService } from './tag';
import { articleService } from './article';
import { draftService } from './draft';
import { metaService } from './meta';
import { systemService } from './system';
import { mediaService } from './media';
import { analyticsService } from './analytics';
import { pipelineService } from './pipeline';
import { tokenService } from './token';
import { customPageService } from './custom-page';
import { backupService } from './backup';

export async function fetchAllMeta() {
  const response = await metaService.getPublicMeta();
  // Response body is { statusCode, data }, return it directly
  return response.body;
}

export async function fetchLatestVersionInfo() {
  const { body } = await metaService.getVersion();
  return { data: body };
}

export async function activeISR() {
  const { body } = await systemService.triggerISR({ body: {} });
  return { data: body };
}

export async function getHttpsConfig() {
  const { body } = await settingService.getHttpsSetting();
  return { data: body };
}

export async function getLoginConfig() {
  const { body } = await settingService.getLoginSetting();
  return { data: body };
}

export async function updateLoginConfig(body: any) {
  const { body: result } = await settingService.updateLoginSetting({ body });
  return result;
}

export async function getSiteInfo() {
  const { body } = await settingService.getSiteInfo();
  return { data: body };
}

export async function updateSiteInfo(body: any) {
  const { body: result } = await settingService.updateSiteInfo({ body });
  return result;
}

export async function getLayoutConfig() {
  const { body } = await settingService.getLayoutSettings();
  return { data: body };
}

export async function updateLayoutConfig(body: any) {
  const { body: result } = await settingService.updateLayoutSettings({ body });
  return result;
}

export async function getAbout() {
  const { body } = await settingService.getAboutInfo();
  return { data: body };
}

export async function updateAbout(body: any) {
  const { body: result } = await settingService.updateAboutInfo({ body });
  return result;
}

export async function getMenu() {
  const { body } = await settingService.getNavigation();
  return { data: body };
}

export async function updateMenu(body: any) {
  const { body: result } = await settingService.updateNavigation({ body });
  return result;
}

export async function getLink() {
  const { body } = await settingService.getFriendLinks();
  return { data: body };
}

export async function createLink(body: any) {
  const { body: result } = await settingService.createFriendLink({ body });
  return result;
}

export async function updateLink(index: any, body: any) {
  const { body: result } = await settingService.updateFriendLink({ params: { index }, body });
  return result;
}

export async function deleteLink(index: any) {
  const { body } = await settingService.deleteFriendLink({ params: { index }, body: {} });
  return body;
}

export async function getSocial() {
  const { body } = await settingService.getSocials();
  return { data: body };
}

export async function updateSocial(body: any) {
  const { body: result } = await settingService.updateSocial({ body });
  return result;
}

export async function deleteSocial(type: any) {
  const { body } = await settingService.deleteSocial({ params: { type } });
  return body;
}

export async function getSocialTypes() {
  const { body } = await settingService.getSocialTypes();
  return { data: body };
}

export async function getWalineConfig() {
  const { body } = await settingService.getWalineSetting();
  return { data: body };
}

export async function updateWalineConfig(body: any) {
  const { body: result } = await settingService.updateWalineSetting({ body });
  return result;
}

export async function getISRConfig() {
  const { body } = await settingService.getISRSetting();
  return { data: body };
}

export async function updateISRConfig(body: any) {
  const { body: result } = await settingService.updateISRSetting({ body });
  return result;
}

export async function clearCaddyLog() {
  const { body } = await settingService.clearCaddyLog({ body: {} });
  return body;
}

export async function getCaddyConfig() {
  const { body } = await settingService.getCaddyConfig();
  return { data: body };
}

export async function getCaddyLog() {
  const { body } = await settingService.getCaddyLog();
  return { data: body };
}

export async function setHttpsConfig(data: any) {
  const { body: result } = await settingService.updateHttpsSetting({ body: data });
  return result;
}

export async function fetchInit(body: any) {
  const { body: result } = await metaService.init({ body });
  return result;
}

export async function searchArtclesByLink(link: any) {
  const { body } = await articleService.searchAdminArticles({ query: { link } });
  return { data: body };
}

export async function scanImgsOfArticles() {
  const { body } = await mediaService.scanMedia({ body: {} });
  return body;
}

export async function exportAllImgs() {
  const { body } = await mediaService.exportMedia();
  return body;
}

export async function login(body: any, options?: any) {
  // Extract username from either field (form uses 'username', API expects 'name')
  const username = body.username || body.name;

  // Validate required fields
  if (!username) {
    throw new Error('Username is required');
  }
  if (!body.password) {
    throw new Error('Password is required');
  }

  // NOTE: server-ng uses bcrypt directly, no need for SHA256 pre-hashing
  // The old server (packages/server) used a custom SHA256+salt scheme
  // Return full ts-rest response { status, body } for proper handling
  return await authService.login({
    body: {
      name: username,
      password: body.password, // Send plaintext password for bcrypt comparison
    },
    ...options,
  });
}

export async function logout(options?: any) {
  const { body } = await authService.logout({ body: {}, ...options });
  return body;
}

export async function restore(data: any, options?: any) {
  const { body } = await backupService.restoreBackup({ body: data, ...options });
  return body;
}

export async function createArticle(body: any) {
  const { body: result } = await articleService.createArticle({ body });
  return result;
}

export async function deleteArticle(id: any) {
  const { body } = await articleService.deleteArticle({
    params: { id: String(id) },
  });
  return body;
}

export async function createCollaborator(body: any) {
  const { body: result } = await userService.createCollaborator({ body });
  return result;
}

export async function createCustomPage(body: any) {
  const { body: result } = await customPageService.createCustomPage({ body });
  return result;
}

export async function createCustomFile(path: any, subPath: any) {
  const { body } = await customPageService.createCustomPageFile({
    query: { path, subPath },
    body: {},
  });
  return body;
}

export async function createCustomFolder(path: any, subPath: any) {
  // Assuming createCustomPageFile handles folders or there is no separate folder creation
  // If createCustomPageFile is the only one, we use it.
  const { body } = await customPageService.createCustomPageFile({
    query: { path, subPath },
    body: {},
  });
  return body;
}

export async function updateCustomPage(body: any) {
  const { body: result } = await customPageService.updateCustomPage({ body });
  return result;
}

export async function updateCustomPageFileInFolder(pathname: any, filePath: any, content: any) {
  const { body } = await customPageService.updateCustomPageFile({
    body: { pathname, filePath, content },
  });
  return body;
}

export async function deleteCustomPageByPath(path: any) {
  const { body } = await customPageService.deleteCustomPage({ query: { path } });
  return body;
}

export async function getCustomPages() {
  const { body } = await customPageService.getCustomPages();
  return { data: body };
}

export async function getCustomPageByPath(path: any) {
  const { body } = await customPageService.getCustomPage({ query: { path } });
  return { data: body };
}

export async function getCustomPageFolderTreeByPath(path: any) {
  const { body } = await customPageService.getCustomPageFolder({ query: { path } });
  return { data: body };
}

export async function getCustomPageFileDataByPath(path: any, key: any) {
  const { body } = await customPageService.getCustomPageFile({ query: { path, key } });
  return { data: body };
}

export async function updateCollaborator(body: any) {
  const { body: result } = await userService.updateCollaborator({ body });
  return result;
}

export async function deleteCollaborator(id: any) {
  const { body } = await userService.deleteCollaborator({ params: { id } });
  return body;
}

export async function getAllCollaborators() {
  const { body } = await userService.getCollaborators();
  return { data: body };
}

export async function getAllCategories() {
  const { body } = await categoryService.getCategories();
  return { data: body };
}

export async function getArticlesByCategory(name: any) {
  const { body } = await categoryService.getArticlesByCategory({
    params: { name },
  });
  return { data: body };
}

export async function getLog(type: any, page: any, pageSize: any = 10) {
  const { body } = await analyticsService.getAnalyticsLogs({
    query: { event: type, page, pageSize },
  });
  return {
    data: {
      data: (body as any).items,
      total: (body as any).total,
    },
  };
}

export async function updateUser(body: any) {
  const { body: result } = await userService.updateProfile({ body });
  return result;
}

export async function createCategory(body: any) {
  const { body: result } = await categoryService.createCategory({ body });
  return result;
}

export async function updateCategory(name: any, value: any) {
  const { body: result } = await categoryService.updateCategory({
    params: { name },
    body: value,
  });
  return result;
}

export async function deleteCategory(name: any) {
  const { body } = await categoryService.deleteCategory({
    params: { name },
  });
  return body;
}

export async function getAllTags() {
  const { body } = await tagService.getTags();
  return { data: body };
}

export async function getArticlesByTag(name: any) {
  const { body } = await articleService.getAdminArticles({
    query: { tag: name },
  });
  return { data: body };
}

export async function createTag(body: any) {
  const { body: result } = await tagService.createTag({ body });
  return result;
}

export async function updateTag(name: any, value: any) {
  const { body: result } = await tagService.updateTag({
    params: { name },
    body: value,
  });
  return result;
}

export async function deleteTag(name: any) {
  const { body } = await tagService.deleteTag({
    params: { name },
  });
  return body;
}

export async function getDraftsByOption(option: any) {
  const { body } = await draftService.getDrafts({ query: option });
  return {
    data: {
      drafts: (body as any).items,
      total: (body as any).total,
      page: (body as any).page,
      pageSize: (body as any).pageSize,
    },
  };
}

export async function createDraft(body: any) {
  const { body: result } = await draftService.createDraft({ body });
  return result;
}

export async function updateDraft(id: any, body: any) {
  const { body: result } = await draftService.updateDraft({
    params: { id },
    body,
  });
  return result;
}

export async function deleteDraft(id: any) {
  const { body } = await draftService.deleteDraft({
    params: { id },
  });
  return body;
}

export async function getDraftById(id: any) {
  const { body } = await draftService.getDraft({
    params: { id },
  });
  return { data: body };
}

export async function publishDraft(id: any, body: any) {
  const { body: result } = await draftService.publishDraft({
    params: { id },
    body: body || {},
  });
  return result;
}

export async function getArticlesByOption(option: any) {
  const { body } = await articleService.getAdminArticles({
    query: {
      page: option.current || 1,
      pageSize: option.pageSize || 10,
      category: option.category,
      tag: option.tag,
      topping: option.topping !== undefined ? String(option.topping) : undefined,
      hidden: option.hidden !== undefined ? String(option.hidden) : undefined,
      password: option.password !== undefined ? String(option.password) : undefined,
    },
  });
  return {
    data: {
      articles: (body as any).items,
      total: (body as any).total,
      page: (body as any).page,
      pageSize: (body as any).pageSize,
    },
  };
}

export async function getArticleById(id: any) {
  const { body } = await articleService.getAdminArticle({
    params: { id },
  });
  return { data: body };
}

export async function updateArticle(id: any, body: any) {
  const { body: result } = await articleService.updateArticle({
    params: { id },
    body,
  });
  return result;
}

export async function getImgs(page: any, pageSize: any) {
  const { body } = await mediaService.getMedia({
    query: { page, pageSize },
  });
  return {
    data: {
      data: (body as any).items,
      total: (body as any).total,
    },
  };
}

export async function deleteImg(id: any) {
  const { body } = await mediaService.deleteMedia({
    params: { sign: id },
  });
  return body;
}

export async function deleteImgBySign(sign: any) {
  const { body } = await mediaService.deleteMedia({
    params: { sign },
  });
  return body;
}

export async function deleteAllIMG() {
  const { body } = await mediaService.batchDeleteMedia({
    body: {},
  });
  return body;
}

export async function getOverview() {
  const { body } = await analyticsService.getAnalyticsOverview({ query: { tab: 'overview' } });
  return { data: body };
}

export async function getAnalysis() {
  return {};
}

export async function getPipelines() {
  const { body } = await pipelineService.getPipelines();
  return { data: body };
}

export async function createPipeline(body: any) {
  const { body: result } = await pipelineService.createPipeline({ body });
  return result;
}

export async function updatePipeline(id: any, body: any) {
  const { body: result } = await pipelineService.updatePipeline({
    params: { id },
    body,
  });
  return result;
}

export async function deletePipeline(id: any) {
  const { body } = await pipelineService.deletePipeline({
    params: { id },
  });
  return body;
}

export async function triggerPipeline(id: any) {
  const { body } = await pipelineService.triggerPipeline({
    params: { id },
    body: {},
  });
  return body;
}

export async function getTokens() {
  const { body } = await tokenService.getTokens();
  return { data: body };
}

export async function createToken(body: any) {
  const { body: result } = await tokenService.createToken({ body });
  return result;
}

export async function updateToken() {
  return {};
}

export async function deleteToken(id: any) {
  const { body } = await tokenService.deleteToken({
    params: { id },
  });
  return body;
}

export async function getCustomCode() {
  const { body } = await settingService.getCustomCode();
  return { data: body };
}

export async function updateCustomCode(body: any) {
  const { body: result } = await settingService.updateCustomCode({ body });
  return result;
}

export async function getStaticConfig() {
  const { body } = await settingService.getStaticSetting();
  return { data: body };
}

export async function updateStaticConfig(body: any) {
  const { body: result } = await settingService.updateStaticSetting({ body });
  return result;
}

export async function getRewardConfig() {
  const { body } = await settingService.getRewards();
  return { data: body };
}

export async function createReward(body: any) {
  const { body: result } = await settingService.createReward({ body });
  return result;
}

export async function updateReward(id: any, body: any) {
  const { body: result } = await settingService.updateReward({ params: { name: id }, body });
  return result;
}

export async function deleteReward(id: any) {
  const { body } = await settingService.deleteReward({ params: { name: id } });
  return body;
}

export async function updateDonate(body: any) {
  const { body: result } = await settingService.createReward({ body });
  return result;
}

export async function deleteDonate(name: any) {
  const { body } = await settingService.deleteReward({ params: { name } });
  return body;
}

export async function getDonate() {
  const { body } = await settingService.getRewards();
  return { data: body };
}

export async function getTags() {
  const { body } = await tagService.getTags();
  return { data: body };
}

export async function getAllCollaboratorsList() {
  const { body } = await userService.getCollaborators();
  return { data: body as any[] };
}

export async function importAll() {
  const { body } = await backupService.importBackup({ body: {} });
  return body;
}

export async function exportAll() {
  const { body } = await backupService.exportBackup();
  return body;
}

export async function getStaticSetting() {
  const { body } = await settingService.getStaticSetting();
  return { data: body };
}

export async function updateStaticSetting(data: any) {
  const { body: result } = await settingService.updateStaticSetting({ body: data });
  return result;
}

export async function getWelcomeData(
  tab: any,
  overviewNum: any = 5,
  viewNum: any = 5,
  articleTabNum: any = 5,
) {
  const { body } = await analyticsService.getAnalyticsOverview({
    query: { tab, overviewNum, viewNum, articleTabNum },
  });
  return { data: body };
}

export async function getPiplelines() {
  const { body } = await pipelineService.getPipelines();
  return { data: body };
}

export async function getPipelineConfig() {
  const { body } = await pipelineService.getPipelineConfig();
  return { data: body };
}

export async function getPipelineById(id: any) {
  const { body } = await pipelineService.getPipeline({
    params: { id },
  });
  return { data: body };
}

export async function updatePipelineById(id: any, data: any) {
  const { body: result } = await pipelineService.updatePipeline({
    params: { id },
    body: data,
  });
  return result;
}

export async function deletePipelineById(id: any) {
  const { body } = await pipelineService.deletePipeline({
    params: { id },
  });
  return body;
}

export async function triggerPipelineById(id: any, input: any) {
  const { body } = await pipelineService.triggerPipeline({
    params: { id },
    body: input,
  });
  return body;
}

export async function createApiToken(data: any) {
  const { body: result } = await tokenService.createToken({ body: data });
  return result;
}

export async function deleteApiToken(id: any) {
  const { body } = await tokenService.deleteToken({
    params: { id },
  });
  return body;
}

export async function getAllApiTokens() {
  const { body } = await tokenService.getTokens();
  return { data: body };
}
