'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDocumentActions } from '@/hooks/use-document-actions';
import { UNFILED_FOLDER_ID, useTeamDocuments, type DocumentItem } from '@/hooks/use-workspace-data';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ChevronRight, FolderPlus, MoreHorizontal, Plus, SlidersHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const timeAgo = (date: string) =>
   formatDistanceToNowStrict(parseISO(date), { addSuffix: true })
      .replace(' minutes', 'min')
      .replace(' hours', 'h')
      .replace(' days', 'd')
      .replace(' weeks', 'w')
      .replace(' months', 'mo')
      .replace(' years', 'y');

/**
 * The document itself, opened from the list.
 *
 * Title and body are separate writes so a rename is not a body save; both
 * commit on blur and only when the value changed. The draft resyncs from the
 * row whenever the row changes, so a teammate's edit lands here rather than
 * being silently overwritten by a stale draft.
 */
function DocumentDialog({
   teamId,
   document: doc,
   onOpenChange,
}: {
   teamId: string;
   document: DocumentItem | null;
   onOpenChange: (open: boolean) => void;
}) {
   const { setTitle, setContent, removeDocument } = useDocumentActions(teamId);
   const [title, setTitleDraft] = useState('');
   const [body, setBody] = useState('');

   useEffect(() => {
      setTitleDraft(doc?.title ?? '');
      setBody(doc?.content ?? '');
   }, [doc?.id, doc?.title, doc?.content]);

   if (!doc) return null;

   return (
      <Dialog open onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
               <DialogTitle className="sr-only">{doc.title}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2">
               <span className="text-xl leading-none">{doc.icon}</span>
               <Input
                  aria-label="Document title"
                  value={title}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => {
                     const next = title.trim();
                     if (!next || next === doc.title) {
                        setTitleDraft(doc.title);
                        return;
                     }
                     void setTitle(doc.id, next);
                  }}
                  className="border-none shadow-none text-lg font-medium px-0 focus-visible:ring-0"
               />
            </div>
            <Textarea
               aria-label="Document content"
               value={body}
               onChange={(event) => setBody(event.target.value)}
               onBlur={() => {
                  if (body === doc.content) return;
                  void setContent(doc.id, body);
               }}
               placeholder="Write something…"
               className="min-h-64 resize-y"
            />
            <div className="flex items-center justify-between">
               <span className="text-xs text-muted-foreground">
                  Edited {timeAgo(doc.updatedAt)} · saves when you click away
               </span>
               <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                     if (await removeDocument(doc.id, doc.title)) onOpenChange(false);
                  }}
               >
                  Delete
               </Button>
            </div>
         </DialogContent>
      </Dialog>
   );
}

/**
 * Team Home — "Documents" tab: documents grouped in collapsible folders,
 * read live and written through Ablo.
 */
export default function TeamDocuments() {
   const { teamId } = useParams<{ teamId: string }>();
   const folders = useTeamDocuments(teamId);
   const { createDocument, createFolder, setFolder } = useDocumentActions(teamId);
   const [openId, setOpenId] = useState<string | null>(null);
   const [newFolder, setNewFolder] = useState(false);
   const [folderName, setFolderName] = useState('');

   const open = folders.flatMap((folder) => folder.documents).find((doc) => doc.id === openId);

   async function addDocument(folderId?: string) {
      const id = await createDocument('Untitled', folderId);
      // Open it straight away: an untitled document you cannot see is not
      // obviously a document.
      if (id) setOpenId(id);
   }

   return (
      <div className="w-full">
         <div className="flex items-center justify-between px-6 py-3 gap-2">
            <div className="grid grid-cols-[1fr_40px] md:grid-cols-[1fr_90px_90px_40px] w-full items-center text-sm text-muted-foreground">
               <span className="flex items-center gap-1 font-medium">Name ↓</span>
               <span className="hidden md:block">Created</span>
               <span className="hidden md:block">Last edited</span>
               <span />
            </div>
            <div className="flex items-center gap-2 shrink-0">
               <Button size="xs" variant="secondary" onClick={() => void addDocument()}>
                  <Plus className="size-4 md:mr-1" />
                  <span className="hidden md:inline">New document</span>
               </Button>
               <Button
                  size="xs"
                  variant="ghost"
                  aria-label="New folder"
                  onClick={() => setNewFolder(true)}
               >
                  <FolderPlus className="size-4" />
               </Button>
               <Button size="xs" variant="ghost">
                  <SlidersHorizontal className="size-4" />
               </Button>
            </div>
         </div>

         {newFolder && (
            <div className="px-6 pb-3">
               <Input
                  autoFocus
                  aria-label="Folder name"
                  value={folderName}
                  placeholder="Folder name"
                  onChange={(event) => setFolderName(event.target.value)}
                  onBlur={async () => {
                     if (folderName.trim()) await createFolder(folderName.trim());
                     setFolderName('');
                     setNewFolder(false);
                  }}
                  onKeyDown={(event) => {
                     if (event.key === 'Enter') event.currentTarget.blur();
                     if (event.key === 'Escape') {
                        setFolderName('');
                        setNewFolder(false);
                     }
                  }}
                  className="max-w-64"
               />
            </div>
         )}

         {folders.length === 0 && !newFolder && (
            <p className="px-6 py-10 text-sm text-muted-foreground text-center">
               No documents yet — the first one is a button away.
            </p>
         )}

         {folders.map((folder) => (
            <Collapsible key={folder.id || 'unfiled'} defaultOpen>
               <CollapsibleTrigger asChild>
                  <button className="group w-full flex items-center gap-2 px-6 h-10 bg-sidebar/30 hover:bg-sidebar/60 border-b border-border/50 text-sm">
                     <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                     <span className="text-base leading-none">{folder.icon}</span>
                     <span className="font-medium">{folder.name}</span>
                     <span className="text-muted-foreground">{folder.documents.length}</span>
                     <span
                        role="button"
                        tabIndex={0}
                        aria-label={`New document in ${folder.name}`}
                        className="ml-auto text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                        onClick={(event) => {
                           // The row toggles the folder; this does not.
                           event.preventDefault();
                           event.stopPropagation();
                           void addDocument(folder.id || undefined);
                        }}
                     >
                        <Plus className="size-3.5" />
                     </span>
                  </button>
               </CollapsibleTrigger>
               <CollapsibleContent>
                  {folder.documents.map((doc) => (
                     <div
                        key={doc.id}
                        className="grid grid-cols-[1fr_40px] md:grid-cols-[1fr_90px_90px_40px] items-center px-6 h-11 hover:bg-sidebar/50 border-b border-border/30 text-sm"
                     >
                        <button
                           className="flex items-center gap-2 min-w-0 pl-6 text-left"
                           onClick={() => setOpenId(doc.id)}
                        >
                           <span className="text-base leading-none">{doc.icon}</span>
                           <span className="font-medium truncate">{doc.title}</span>
                        </button>
                        <span className="hidden md:block text-xs text-muted-foreground">
                           {timeAgo(doc.createdAt)}
                        </span>
                        <span className="hidden md:block text-xs text-muted-foreground">
                           {timeAgo(doc.updatedAt)}
                        </span>
                        <div className="flex items-center gap-1 justify-end">
                           <Avatar className="size-5">
                              <AvatarImage src={doc.creator.avatarUrl} alt={doc.creator.name} />
                              <AvatarFallback>{doc.creator.name[0]}</AvatarFallback>
                           </Avatar>
                           <DropdownMenu>
                              <DropdownMenuTrigger
                                 aria-label={`Move ${doc.title}`}
                                 className="text-muted-foreground hover:text-foreground outline-none"
                              >
                                 <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                 {folders.map((target) => (
                                    <DropdownMenuItem
                                       key={target.id || 'unfiled'}
                                       disabled={target.id === (doc.folderId ?? UNFILED_FOLDER_ID)}
                                       onClick={() => void setFolder(doc.id, target.id || null)}
                                    >
                                       <span>{target.icon}</span> Move to {target.name}
                                    </DropdownMenuItem>
                                 ))}
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                     </div>
                  ))}
               </CollapsibleContent>
            </Collapsible>
         ))}

         <DocumentDialog
            teamId={teamId}
            document={open ?? null}
            onOpenChange={(value) => !value && setOpenId(null)}
         />
      </div>
   );
}
