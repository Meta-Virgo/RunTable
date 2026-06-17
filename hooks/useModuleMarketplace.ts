import React from "react";
import type {
  CreateUserModuleTemplateInput,
  ModuleTemplate,
  ModuleTemplateDetail,
  UpdateUserModuleTemplateInput,
} from "../types";
import {
  createUserModuleTemplate,
  createRoomFromModuleTemplate,
  deleteUserModuleTemplate,
  fetchModuleTemplateDetail,
  fetchModuleTemplates,
  filterModuleTemplates,
  getModuleTemplateTags,
  updateUserModuleTemplate,
  type ModuleTemplateFilter,
} from "../services/moduleMarketplace";

export function useModuleMarketplace(filter: ModuleTemplateFilter = {}) {
  const [templates, setTemplates] = React.useState<ModuleTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<ModuleTemplateDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDetailLoading, setIsDetailLoading] = React.useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = React.useState(false);
  const [isPublishingTemplate, setIsPublishingTemplate] = React.useState(false);
  const [isUpdatingTemplate, setIsUpdatingTemplate] = React.useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const loadTemplates = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: loadError } = await fetchModuleTemplates();
    if (loadError) {
      setError(loadError.message || "模组市场加载失败");
      setTemplates([]);
    } else {
      setTemplates(data || []);
    }
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openTemplate = React.useCallback(async (template: ModuleTemplate) => {
    setIsDetailLoading(true);
    setDetailError(null);
    const { data, error: loadError } = await fetchModuleTemplateDetail(
      template.id
    );
    let detail: ModuleTemplateDetail;
    if (loadError) {
      setDetailError(loadError.message || "模组详情加载失败");
      detail = { ...template };
    } else {
      detail = data || { ...template };
    }
    setSelectedTemplate(detail);
    setIsDetailLoading(false);
    return detail;
  }, []);

  const closeTemplate = React.useCallback(() => {
    setSelectedTemplate(null);
    setDetailError(null);
  }, []);

  const createRoom = React.useCallback(
    async (input: {
      templateId: string;
      roomType: "text" | "voice";
      password?: string;
      coverImageUrl?: string | null;
    }) => {
      setIsCreatingRoom(true);
      const { data, error: createError } = await createRoomFromModuleTemplate(
        {
          templateId: input.templateId,
          roomType: input.roomType,
          password: input.password || null,
          coverImageUrl: input.coverImageUrl || null,
        }
      ).finally(() => setIsCreatingRoom(false));

      if (createError) {
        throw createError;
      }

      return data as string;
    },
    []
  );

  const publishTemplate = React.useCallback(
    async (input: CreateUserModuleTemplateInput) => {
      setIsPublishingTemplate(true);
      const { data, error: publishError } = await createUserModuleTemplate(
        input
      ).finally(() => setIsPublishingTemplate(false));

      if (publishError) {
        throw publishError;
      }

      await loadTemplates();
      return data as string;
    },
    [loadTemplates]
  );

  const updateTemplate = React.useCallback(
    async (input: UpdateUserModuleTemplateInput) => {
      setIsUpdatingTemplate(true);
      const { data, error: updateError } = await updateUserModuleTemplate(
        input
      ).finally(() => setIsUpdatingTemplate(false));

      if (updateError) {
        throw updateError;
      }

      await loadTemplates();
      if (selectedTemplate?.id === input.templateId) {
        const { data: detail } = await fetchModuleTemplateDetail(input.templateId);
        setSelectedTemplate(detail || null);
      }
      return data as string;
    },
    [loadTemplates, selectedTemplate?.id]
  );

  const deleteTemplate = React.useCallback(
    async (templateId: string) => {
      setIsDeletingTemplate(true);
      const { error: deleteError } = await deleteUserModuleTemplate(
        templateId
      ).finally(() => setIsDeletingTemplate(false));

      if (deleteError) {
        throw deleteError;
      }

      setSelectedTemplate((current) =>
        current?.id === templateId ? null : current
      );
      await loadTemplates();
    },
    [loadTemplates]
  );

  return {
    templates,
    visibleTemplates: filterModuleTemplates(templates, filter),
    tags: getModuleTemplateTags(templates),
    selectedTemplate,
    isLoading,
    isDetailLoading,
    isCreatingRoom,
    isPublishingTemplate,
    isUpdatingTemplate,
    isDeletingTemplate,
    error,
    detailError,
    refresh: loadTemplates,
    openTemplate,
    closeTemplate,
    createRoom,
    publishTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
