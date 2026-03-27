'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar/sidebar';
import { QuizCard } from '@/components/quiz/quiz-card';
import { RightPanel } from '@/components/panel/right-panel';
import { AiTutorDrawer } from '@/components/panel/ai-tutor-drawer';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Loader2,
  FolderOpen,
  ListTree,
  Sparkles,
  Trash2,
  AlertTriangle,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  FolderTree,
  Pencil,
} from 'lucide-react';
import { MaterialUploadDialog } from '@/components/sidebar/material-upload-dialog';
import type { Chapter, ErrorRecord } from '@/types';
import { cn } from '@/lib/utils';

type ApiQuestion = {
  id: string;
  type: string;
  isStarred?: boolean;
  blanksData?: string | null;
  usedBlanksHistory?: string | null;
  displayText?: string | null;
  qaQuestion?: string | null;
  qaReferenceAnswer?: string | null;
};

type ApiKnowledgePoint = {
  id: string;
  name: string;
  chapterId: string;
  originalText: string;
  completedCount?: number;
  totalCount?: number;
  questions?: ApiQuestion[];
};

type ApiChapter = {
  id: string;
  name: string;
  completedCount?: number;
  totalCount?: number;
  knowledgePoints?: ApiKnowledgePoint[];
};

type ApiMaterial = {
  id: string;
  title: string;
  chapters?: ApiChapter[];
};

type ClearStudyDataResponse = {
  deletedQuestions: number;
  deletedErrorLogs: number;
  error?: string;
};

type QuestionScope = 'current' | 'errors' | 'favorites';

type ChapterQuestionItem = {
  question: ApiQuestion;
  knowledgePoint: ApiKnowledgePoint;
};

const fetchMaterials = async (url: string): Promise<ApiMaterial[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch materials');
  }
  return response.json() as Promise<ApiMaterial[]>;
};

const fetchErrors = async (url: string): Promise<ErrorRecord[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch errors');
  }
  return response.json() as Promise<ErrorRecord[]>;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const findKnowledgePointById = (material: ApiMaterial | undefined, kpId: string | null): ApiKnowledgePoint | null => {
  if (!material || !kpId) return null;

  for (const chapter of material.chapters || []) {
    const found = (chapter.knowledgePoints || []).find((kp) => kp.id === kpId);
    if (found) return found;
  }

  return null;
};

const getChapterItems = (
  chapter: ApiChapter | null,
  scope: QuestionScope,
  errorQuestionIdSet: Set<string>
): ChapterQuestionItem[] => {
  if (!chapter?.knowledgePoints?.length) return [];
  const allItems: ChapterQuestionItem[] = [];

  for (const kp of chapter.knowledgePoints) {
    for (const q of kp.questions || []) {
      allItems.push({ question: q, knowledgePoint: kp });
    }
  }

  if (scope === 'errors') {
    return allItems.filter((item) => errorQuestionIdSet.has(item.question.id));
  }
  if (scope === 'favorites') {
    return allItems.filter((item) => Boolean(item.question.isStarred));
  }
  return allItems;
};

export default function HomePage() {
  const searchParams = useSearchParams();
  const { data: materials, isLoading, mutate } = useSWR<ApiMaterial[]>('/api/materials', fetchMaterials);
  const { data: errors = [], mutate: mutateErrors } = useSWR<ErrorRecord[]>('/api/errors', fetchErrors);

  const [selectedKnowledgePointId, setSelectedKnowledgePointId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const [initialContext, setInitialContext] = useState('');
  const [chapterSheetOpen, setChapterSheetOpen] = useState(false);
  const [clearingStudyData, setClearingStudyData] = useState(false);
  const [wrongTip, setWrongTip] = useState<string>('');
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [mobileRightPanelOpen, setMobileRightPanelOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [appliedQuestionId, setAppliedQuestionId] = useState<string | null>(null);
  const [questionScope, setQuestionScope] = useState<QuestionScope>('current');
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null);
  const [studyCompleted, setStudyCompleted] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialEditOpen, setMaterialEditOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem('active-material-id');
    if (saved) setActiveMaterialId(saved);
  }, []);

  useEffect(() => {
    if (activeMaterialId) {
      window.localStorage.setItem('active-material-id', activeMaterialId);
    }
  }, [activeMaterialId]);

  const currentMaterial = useMemo(() => {
    if (!Array.isArray(materials) || materials.length === 0) return undefined;
    if (!activeMaterialId) return materials[0];
    return materials.find((item) => item.id === activeMaterialId) || materials[0];
  }, [materials, activeMaterialId]);

  useEffect(() => {
    if (!materials?.length) return;
    if (!activeMaterialId || !materials.some((m) => m.id === activeMaterialId)) {
      setActiveMaterialId(materials[0].id);
    }
  }, [materials, activeMaterialId]);

  const isMobileMode = isMobileViewport;
  const selectedKP = useMemo(
    () => findKnowledgePointById(currentMaterial, selectedKnowledgePointId),
    [currentMaterial, selectedKnowledgePointId]
  );

  useEffect(() => {
    if (!currentMaterial || selectedKnowledgePointId) return;

    const firstChapter = currentMaterial.chapters?.[0];
    const firstKP = firstChapter?.knowledgePoints?.[0];
    if (firstKP) {
      setSelectedKnowledgePointId(firstKP.id);
      setCurrentQuestionIndex(0);
    }
  }, [currentMaterial, selectedKnowledgePointId]);

  useEffect(() => {
    const questionId = searchParams.get('questionId');
    if (!questionId || appliedQuestionId === questionId) return;
    if (!currentMaterial?.chapters?.length) return;

    for (const chapter of currentMaterial.chapters) {
      const chapterItems = getChapterItems(chapter, 'current', new Set());
      const foundIndex = chapterItems.findIndex((item) => item.question.id === questionId);
      if (foundIndex >= 0) {
        setQuestionScope('current');
        setSelectedKnowledgePointId(chapterItems[foundIndex].knowledgePoint.id);
        setCurrentQuestionIndex(foundIndex);
        setAppliedQuestionId(questionId);
        setWrongTip('');
        setStudyCompleted(false);
        return;
      }
    }
  }, [searchParams, currentMaterial, appliedQuestionId]);

  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [questionScope]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const sync = () => setIsMobileViewport(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const errorQuestionIdSet = useMemo(() => {
    return new Set(errors.filter((e) => !e.resolved).map((e) => e.questionId));
  }, [errors]);

  const selectedChapter = useMemo(() => {
    if (!currentMaterial?.chapters?.length) return null;
    if (!selectedKP?.chapterId) return currentMaterial.chapters[0];
    return currentMaterial.chapters.find((chapter) => chapter.id === selectedKP.chapterId) || currentMaterial.chapters[0];
  }, [currentMaterial, selectedKP]);

  const selectedChapterIndex = useMemo(() => {
    if (!currentMaterial?.chapters?.length || !selectedChapter) return -1;
    return currentMaterial.chapters.findIndex((chapter) => chapter.id === selectedChapter.id);
  }, [currentMaterial, selectedChapter]);

  const chapterQuestionItems = useMemo<ChapterQuestionItem[]>(() => {
    return getChapterItems(selectedChapter, 'current', errorQuestionIdSet);
  }, [selectedChapter, errorQuestionIdSet]);

  const scopedQuestionItems = useMemo<ChapterQuestionItem[]>(() => {
    return getChapterItems(selectedChapter, questionScope, errorQuestionIdSet);
  }, [questionScope, selectedChapter, errorQuestionIdSet]);

  const currentScopedItem = scopedQuestionItems[currentQuestionIndex] || null;
  const currentScopedKP = currentScopedItem?.knowledgePoint || null;

  useEffect(() => {
    const maxIndex = Math.max(0, scopedQuestionItems.length - 1);
    if (currentQuestionIndex > maxIndex) {
      setCurrentQuestionIndex(maxIndex);
    }
  }, [currentQuestionIndex, scopedQuestionItems.length]);

  useEffect(() => {
    if (!currentScopedKP?.id) return;
    if (selectedKnowledgePointId !== currentScopedKP.id) {
      setSelectedKnowledgePointId(currentScopedKP.id);
    }
  }, [currentScopedKP?.id, selectedKnowledgePointId]);

  const sidebarChapters = useMemo(() => {
    if (!currentMaterial?.chapters?.length) {
      return [];
    }

    return currentMaterial.chapters.map((chapter) => {
      const normalizedKnowledgePoints = (chapter.knowledgePoints || []).map((kp) => {
        const kpQuestions = kp.questions || [];
        const totalCount = kpQuestions.length;
        const unresolvedCount = kpQuestions.filter((q) => errorQuestionIdSet.has(q.id)).length;
        const completedCount = Math.max(totalCount - unresolvedCount, 0);

        return {
          ...kp,
          completedCount,
          totalCount,
        };
      });

      const completedCount = normalizedKnowledgePoints.reduce((sum, kp) => sum + kp.completedCount, 0);
      const totalCount = normalizedKnowledgePoints.reduce((sum, kp) => sum + kp.totalCount, 0);

      return {
        id: chapter.id,
        name: chapter.name,
        materialId: currentMaterial.id,
        knowledgePoints: normalizedKnowledgePoints,
        completedCount,
        totalCount,
      };
    });
  }, [currentMaterial, errorQuestionIdSet]) as Chapter[];

  const moveToChapter = (targetIndex: number, useLastQuestion = false) => {
    if (!currentMaterial?.chapters?.length) return;
    if (targetIndex < 0 || targetIndex >= currentMaterial.chapters.length) return;

    const chapter = currentMaterial.chapters[targetIndex];
    if (!chapter) return;

    const scopedItems = getChapterItems(chapter, questionScope, errorQuestionIdSet);
    const firstKP = chapter.knowledgePoints?.[0];

    if (scopedItems.length > 0) {
      const targetQuestionIndex = useLastQuestion ? scopedItems.length - 1 : 0;
      setSelectedKnowledgePointId(scopedItems[targetQuestionIndex].knowledgePoint.id);
      setCurrentQuestionIndex(targetQuestionIndex);
    } else if (firstKP) {
      setSelectedKnowledgePointId(firstKP.id);
      setCurrentQuestionIndex(0);
    }

    setStudyCompleted(false);
    setWrongTip('');
  };

  const handlePrevChapter = () => {
    if (selectedChapterIndex <= 0) return;
    moveToChapter(selectedChapterIndex - 1, true);
  };

  const handleNextChapter = () => {
    if (!currentMaterial?.chapters?.length) return;
    if (selectedChapterIndex < currentMaterial.chapters.length - 1) {
      moveToChapter(selectedChapterIndex + 1);
      return;
    }
    setStudyCompleted(true);
  };

  const handleSelectKP = (kp: ApiKnowledgePoint) => {
    setSelectedKnowledgePointId(kp.id);
    const targetIndex = scopedQuestionItems.findIndex((item) => item.knowledgePoint.id === kp.id);
    setCurrentQuestionIndex(targetIndex >= 0 ? targetIndex : 0);
    setChapterSheetOpen(false);
    setWrongTip('');
    setStudyCompleted(false);
  };

  const handleOpenAiTutor = (wrongAnswerCtx?: string) => {
    let ctx = `【当前学习段落】\n${selectedKP?.originalText || ''}`;
    if (wrongAnswerCtx) {
      ctx += `\n\n【我的错误回答记录】\n${wrongAnswerCtx}`;
    }
    setInitialContext(ctx);
    setAiTutorOpen(true);
  };

  const handleClearStudyData = async () => {
    if (!currentMaterial?.id || clearingStudyData) return;

    const confirmed = window.confirm('确认清空当前资料的学习数据吗？这会删除题目和错题记录。');
    if (!confirmed) return;

    setClearingStudyData(true);
    try {
      const response = await fetch('/api/study-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId: currentMaterial.id, clearSourceText: true }),
      });
      const data = (await response.json()) as ClearStudyDataResponse;

      if (!response.ok) {
        throw new Error(data.error || '清空学习数据失败');
      }

      await mutate();
      await mutateErrors();
      setCurrentQuestionIndex(0);
      setStudyCompleted(false);

      alert(`已清空学习数据：删除题目 ${data.deletedQuestions} 条，删除错题记录 ${data.deletedErrorLogs} 条`);
    } catch (error: unknown) {
      alert(getErrorMessage(error, '清空学习数据失败'));
      console.error(error);
    } finally {
      setClearingStudyData(false);
    }
  };

  const handleWrongAnswer = (wrongText: string) => {
    setWrongTip(`本题已加入错题本：${wrongText}`);
    void mutateErrors();
  };

  const handleRegenerateTitleAndQuestions = async () => {
    if (!currentMaterial?.id || !selectedChapter?.id || regeneratingAll) return;

    setRegeneratingAll(true);
    try {
      const response = await apiClient.fetch('/api/ai/regenerate-title-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialId: currentMaterial.id,
          chapterId: selectedChapter.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || '重新生成失败');
      }

      await mutate();
      await mutateErrors();
      setCurrentQuestionIndex(0);
      setWrongTip('');
      setStudyCompleted(false);
      alert(`已完成重生成：新标题「${data.title}」，本章新增 ${data.createdCount} 题`);
    } catch (error: unknown) {
      alert(getErrorMessage(error, '重新生成失败'));
      console.error(error);
    } finally {
      setRegeneratingAll(false);
    }
  };

  const handleSelectMaterial = (materialId: string) => {
    setActiveMaterialId(materialId);
    setSelectedKnowledgePointId(null);
    setCurrentQuestionIndex(0);
    setQuestionScope('current');
    setStudyCompleted(false);
    setMaterialPickerOpen(false);
  };

  const handleDeleteMaterial = async (materialId: string) => {
    const confirmed = window.confirm('确认彻底删除该资料吗？该操作不可恢复。');
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/materials/${materialId}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || '删除失败');

      if (activeMaterialId === materialId) {
        setActiveMaterialId(null);
        setSelectedKnowledgePointId(null);
        setCurrentQuestionIndex(0);
      }

      await mutate();
      setMaterialPickerOpen(false);
    } catch (error: unknown) {
      alert(getErrorMessage(error, '删除资料失败'));
    }
  };

  const handleEditMaterialTitle = async () => {
    if (!currentMaterial?.id || !editingTitle.trim()) return;
    try {
      const response = await fetch(`/api/materials/${currentMaterial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '更新资料信息失败');
      await mutate();
      setMaterialEditOpen(false);
    } catch (error: unknown) {
      alert(getErrorMessage(error, '更新资料信息失败'));
    }
  };

  const questions: ApiQuestion[] = scopedQuestionItems.map((item) => item.question);

  return (
    <>
      <Navbar
        isMobile={isMobileMode}
        rightEntry={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-2"
            onClick={() => {
              if (isMobileMode) {
                setMobileRightPanelOpen((prev) => !prev);
              } else {
                setRightPanelCollapsed((prev) => !prev);
              }
            }}
          >
            {isMobileMode ? (
              mobileRightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />
            ) : rightPanelCollapsed ? (
              <PanelRightOpen className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
            <span className={cn(isMobileMode && 'hidden sm:inline')}>
              {isMobileMode ? (mobileRightPanelOpen ? '收起右栏' : '展开右栏') : rightPanelCollapsed ? '展开右栏' : '收起右栏'}
            </span>
          </Button>
        }
        chapterEntry={
          <Sheet open={chapterSheetOpen} onOpenChange={setChapterSheetOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2">
                  <ListTree className="h-4 w-4" />
                  <span className={cn(isMobileMode && 'hidden sm:inline')}>章节目录</span>
                </Button>
              }
            />
            <SheetContent side="left" className={cn('p-0', isMobileMode ? 'w-full sm:max-w-full' : 'w-[360px] sm:max-w-[360px]')}>
              <SheetHeader className="border-b border-border/60">
                <SheetTitle>{currentMaterial?.title || '暂无学习资料'}</SheetTitle>
                <SheetDescription>在这里管理资料、章节和学习进度</SheetDescription>
              </SheetHeader>

              <div className="p-4 space-y-2">
                <MaterialUploadDialog
                  onCreatedMaterial={(materialId) => {
                    setActiveMaterialId(materialId);
                    setSelectedKnowledgePointId(null);
                    setCurrentQuestionIndex(0);
                    setQuestionScope('current');
                    setStudyCompleted(false);
                    void mutate();
                  }}
                />
                <Button variant="outline" className="w-full gap-2" onClick={() => setMaterialPickerOpen(true)}>
                  <FolderTree className="h-4 w-4" />
                  选择资料文件夹
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setEditingTitle(currentMaterial?.title || '');
                    setMaterialEditOpen(true);
                  }}
                  disabled={!currentMaterial}
                >
                  <Pencil className="h-4 w-4" />
                  编辑当前资料信息
                </Button>
              </div>

              {currentMaterial ? (
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <Sidebar
                    chapters={sidebarChapters}
                    materialTitle={currentMaterial.title || ''}
                    selectedKnowledgePointId={selectedKnowledgePointId}
                    onSelectKnowledgePoint={handleSelectKP}
                  />
                </div>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">暂无资料，请先上传。</div>
              )}

              <div className="p-4 border-t border-border/60 space-y-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleRegenerateTitleAndQuestions}
                  disabled={!currentMaterial || !selectedChapter || regeneratingAll}
                >
                  {regeneratingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {regeneratingAll ? '正在重新生成...' : '重新生成'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleClearStudyData}
                  disabled={!currentMaterial || clearingStudyData}
                >
                  {clearingStudyData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {clearingStudyData ? '正在清空学习数据...' : '清空当前学习数据'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        }
      />

      <div className={cn('flex flex-1 min-h-0 min-w-0 overflow-hidden items-stretch transition-all duration-300', !isMobileMode && 'min-h-[calc(100dvh-56px)]')}>
        <main className={cn('flex-1 min-h-0 overflow-auto flex flex-col items-center justify-start', isMobileMode ? 'p-3' : 'p-6')}>
          {wrongTip && (
            <div className="w-full max-w-3xl mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="line-clamp-1">{wrongTip}</span>
            </div>
          )}

          {studyCompleted && (
            <div className="w-full max-w-3xl mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>全部章节已刷完，恭喜完成本轮学习。</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center flex-1 h-full w-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedKP ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground h-full">
              <FolderOpen className="h-16 w-16 mb-4 opacity-20" />
              <p>请在上方“章节目录”里上传资料或选择知识点</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground h-full gap-3">
              <p>{questionScope === 'current' ? '当前章节暂无题目' : questionScope === 'errors' ? '当前章节暂无错题' : '当前章节暂无收藏题'}</p>
              {questionScope === 'current' ? (
                selectedChapter && (
                  <Button onClick={handleRegenerateTitleAndQuestions} disabled={regeneratingAll}>
                    重新生成
                  </Button>
                )
              ) : (
                <Button variant="outline" onClick={() => setQuestionScope('current')}>
                  返回当前题库
                </Button>
              )}
            </div>
          ) : (
            <div className="w-full max-w-3xl space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={questionScope === 'current' ? 'default' : 'outline'} onClick={() => setQuestionScope('current')}>
                  当前 ({chapterQuestionItems.length})
                </Button>
                <Button size="sm" variant={questionScope === 'errors' ? 'default' : 'outline'} onClick={() => setQuestionScope('errors')}>
                  错题 ({chapterQuestionItems.filter((item) => errorQuestionIdSet.has(item.question.id)).length})
                </Button>
                <Button size="sm" variant={questionScope === 'favorites' ? 'default' : 'outline'} onClick={() => setQuestionScope('favorites')}>
                  收藏 ({chapterQuestionItems.filter((item) => item.question.isStarred).length})
                </Button>
              </div>

              <QuizCard
                questions={questions}
                currentIndex={Math.min(currentQuestionIndex, Math.max(0, questions.length - 1))}
                knowledgePointRaw={currentScopedKP || selectedKP || {}}
                onIndexChange={setCurrentQuestionIndex}
                onWrongAnswerSubmit={handleWrongAnswer}
                onPrevChapter={handlePrevChapter}
                onNextChapter={handleNextChapter}
                onCompleteAll={() => setStudyCompleted(true)}
                hasPrevChapter={selectedChapterIndex > 0}
                hasNextChapter={Boolean(currentMaterial?.chapters && selectedChapterIndex >= 0 && selectedChapterIndex < currentMaterial.chapters.length - 1)}
              />
            </div>
          )}
        </main>

        <div className={cn('hidden lg:flex h-full shrink-0 border-l border-border/60 bg-card/30 transition-all duration-300 overflow-hidden', isMobileMode && 'hidden', rightPanelCollapsed ? 'w-[52px]' : 'w-[280px]')}>
          <RightPanel errors={errors} onOpenAiTutor={() => handleOpenAiTutor()} collapsed={rightPanelCollapsed} />
        </div>

        <AiTutorDrawer messages={[]} knowledgePointName={selectedKP?.name || ''} open={aiTutorOpen} initialContext={initialContext} onOpenChange={setAiTutorOpen} />
      </div>

      <Dialog open={materialPickerOpen} onOpenChange={setMaterialPickerOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>选择资料文件夹</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {(materials || []).map((material) => (
              <div key={material.id} className="flex items-center gap-2">
                <Button
                  variant={material.id === currentMaterial?.id ? 'default' : 'outline'}
                  className="flex-1 justify-start"
                  onClick={() => handleSelectMaterial(material.id)}
                >
                  {material.title}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteMaterial(material.id)}>
                  删除
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={materialEditOpen} onOpenChange={setMaterialEditOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>编辑当前资料信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} placeholder="资料标题" />
            <Button className="w-full" onClick={handleEditMaterialTitle} disabled={!editingTitle.trim()}>
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isMobileMode && (
        <Sheet open={mobileRightPanelOpen} onOpenChange={setMobileRightPanelOpen}>
          <SheetContent side="right" className="w-full sm:w-[340px] p-0" showCloseButton={false}>
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b border-border/60">
                <span className="text-sm font-medium">学习侧边栏</span>
                <Button variant="ghost" size="sm" onClick={() => setMobileRightPanelOpen(false)}>
                  关闭
                </Button>
              </div>
              <div className="flex-1 min-h-0">
                <RightPanel errors={errors} onOpenAiTutor={() => handleOpenAiTutor()} />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
