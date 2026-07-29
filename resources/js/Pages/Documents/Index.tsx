import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    AppWindow,
    ArrowUpDown,
    Camera,
    CheckCheck,
    ClipboardPaste,
    Copy,
    Download,
    ExternalLink,
    Folder as FolderIcon,
    FolderInput,
    FolderOpen,
    FolderPlus,
    FolderUp,
    Grid2x2,
    Image as ImageIcon,
    Info,
    LayoutGrid,
    LayoutTemplate,
    List,
    Maximize2,
    Pencil,
    RefreshCw,
    Rows3,
    Scissors,
    Table2,
    Trash2,
    Upload,
} from 'lucide-react';
import clsx from 'clsx';
import AppLayout from '@/Layouts/AppLayout';
import PageHeader from '@/Components/PageHeader';
import ContextMenu, { type MenuEntry, type QuickAction } from '@/Pages/Documents/Partials/ContextMenu';
import ConfirmDialog from '@/Pages/Documents/Partials/ConfirmDialog';
import FolderTree from '@/Pages/Documents/Partials/FolderTree';
import ItemView, { type ItemHandlers } from '@/Pages/Documents/Partials/ItemView';
import MoveDialog from '@/Pages/Documents/Partials/MoveDialog';
import NameDialog from '@/Pages/Documents/Partials/NameDialog';
import PropertiesDialog from '@/Pages/Documents/Partials/PropertiesDialog';
import TemplateDialog, { type FolderTemplate } from '@/Pages/Documents/Partials/TemplateDialog';
import UploadDialog from '@/Pages/Documents/Partials/UploadDialog';
import { AddressBar, CommandBar } from '@/Pages/Documents/Partials/ExplorerBars';
import { officeAppFor, openInAppLabel } from '@/Pages/Documents/Partials/office';
import {
    type UploadEntry,
    MAX_ENTRIES,
    canPickDirectory,
    entriesFromDirectoryPicker,
    entriesFromDrop,
    entriesFromFiles,
    looksLikeFolder,
} from '@/Pages/Documents/Partials/upload';
import {
    type ClipboardState,
    type ExplorerItem,
    type ItemKey,
    type SortKey,
    type SortState,
    type ViewMode,
    VIEW_LABELS,
    SORT_LABELS,
    intersects,
    keyOf,
    nameOf,
    normalizeView,
    readClipboard,
    readNav,
    refOf,
    sizeOf,
    sortItems,
    writeClipboard,
    writeNav,
} from '@/Pages/Documents/Partials/explorer';
import { usePageProps } from '@/hooks/usePageProps';
import { fmtBytes } from '@/lib/format';
import type {
    AclEntry,
    ExplorerFileRow,
    ExplorerFolderRow,
    FolderCrumb,
    Option,
    ProjectOption,
    TreeFolder,
} from '@/types/models';

interface IndexProps extends Record<string, unknown> {
    folderId: number | null;
    breadcrumbs: FolderCrumb[];
    folders: ExplorerFolderRow[];
    documents: ExplorerFileRow[];
    tree: TreeFolder[];
    can: { create: boolean; edit: boolean; delete: boolean; manage_permissions: boolean };
    currentFolder: {
        id: number;
        name: string;
        is_restricted: boolean;
        acl: AclEntry[];
    } | null;
    users: Option[];
    categories: Record<string, string>;
    projects: ProjectOption[];
    folderTemplates: FolderTemplate[];
    filters: { search: string; category: string; project: number | null };
    searchMode: boolean;
}

type PropsTarget = { type: 'folder' | 'file'; id: number };

export default function Index() {
    const props = usePageProps<IndexProps>();
    const {
        folderId,
        breadcrumbs,
        folders,
        documents,
        tree,
        can,
        currentFolder,
        users,
        categories,
        projects,
        folderTemplates,
        filters,
        searchMode,
    } = props;
    const pageErrors = (props.errors ?? {}) as Record<string, string>;

    const coarse = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
        [],
    );

    /* ---------------- nézet + rendezés ---------------- */
    const [view, setView] = useState<ViewMode>(() =>
        normalizeView(localStorage.getItem('octopus.files.view')),
    );
    useEffect(() => localStorage.setItem('octopus.files.view', view), [view]);

    const [sort, setSort] = useState<SortState>(() => {
        try {
            const raw = localStorage.getItem('octopus.files.sort');
            if (raw) return JSON.parse(raw) as SortState;
        } catch {
            /* alapértelmezés */
        }
        return { key: 'name', dir: 'asc' };
    });
    useEffect(() => localStorage.setItem('octopus.files.sort', JSON.stringify(sort)), [sort]);

    /* ---------------- elemek ---------------- */
    const items = useMemo<ExplorerItem[]>(
        () =>
            sortItems(
                [
                    ...folders.map((row) => ({ type: 'folder', row }) as ExplorerItem),
                    ...documents.map((row) => ({ type: 'file', row }) as ExplorerItem),
                ],
                sort,
            ),
        [folders, documents, sort],
    );

    /* ---------------- kijelölés ---------------- */
    const [selected, setSelected] = useState<Set<ItemKey>>(new Set());
    const [anchor, setAnchor] = useState<ItemKey | null>(null);
    const [renaming, setRenaming] = useState<ItemKey | null>(null);

    const selectedItems = useMemo(
        () => items.filter((i) => selected.has(keyOf(i))),
        [items, selected],
    );
    const selectedSize = selectedItems.reduce((sum, i) => sum + sizeOf(i), 0);

    const selectOnly = (key: ItemKey) => {
        setSelected(new Set([key]));
        setAnchor(key);
    };

    const selectRange = (from: ItemKey, to: ItemKey) => {
        const a = items.findIndex((i) => keyOf(i) === from);
        const b = items.findIndex((i) => keyOf(i) === to);
        if (a < 0 || b < 0) return;
        const [start, end] = a < b ? [a, b] : [b, a];
        setSelected(new Set(items.slice(start, end + 1).map(keyOf)));
    };

    /* ---------------- vágólap ---------------- */
    const [clipboard, setClipboard] = useState<ClipboardState | null>(() => readClipboard());
    const cutKeys = useMemo(
        () => new Set(clipboard?.mode === 'cut' ? clipboard.keys : []),
        [clipboard],
    );

    /* ---------------- párbeszédek ---------------- */
    const [newFolderIn, setNewFolderIn] = useState<{ id: number | null } | null>(null);
    const [templateTarget, setTemplateTarget] = useState<{ id: number | null; path: string } | null>(
        null,
    );
    const [moveTargets, setMoveTargets] = useState<ExplorerItem[] | null>(null);
    const [propsTarget, setPropsTarget] = useState<PropsTarget | null>(null);
    const [upload, setUpload] = useState<{
        entries: UploadEntry[];
        folderId: number | null;
        notice?: string;
    } | null>(null);
    const [confirm, setConfirm] = useState<{
        title: string;
        message: ReactNode;
        items: { type: 'folder' | 'file'; id: number }[];
        recursive: boolean;
    } | null>(null);
    const [info, setInfo] = useState<{ title: string; message: ReactNode } | null>(null);
    const [menu, setMenu] = useState<{
        x: number;
        y: number;
        entries: MenuEntry[];
        quick?: QuickAction[];
    } | null>(null);
    const [busy, setBusy] = useState(false);

    const dialogOpen =
        newFolderIn !== null ||
        templateTarget !== null ||
        moveTargets !== null ||
        propsTarget !== null ||
        upload !== null ||
        confirm !== null;

    /* ---------------- fájl-bemenetek ---------------- */
    const fileInput = useRef<HTMLInputElement>(null);
    const folderInput = useRef<HTMLInputElement>(null);
    const galleryInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);

    // A mappaválasztó kapcsolói nem szerepelnek a React attribútum-listáján,
    // ezért kézzel tesszük ki őket (a fájl-lista így viszi a relatív útvonalat).
    useEffect(() => {
        folderInput.current?.setAttribute('webkitdirectory', '');
        folderInput.current?.setAttribute('directory', '');
    }, []);

    /**
     * A választott/behúzott elemek átvétele. A böngésző néha a MAPPÁT magát
     * adja át „fájlként”, a tartalma nélkül (0 bájt, típus nélkül) — ezeket
     * kiszűrjük, mert feltöltve csak üres szemetet hoznának létre. Üres
     * eredménynél is megnyitjuk a párbeszédet az indoklással: a néma elhalás
     * azt a látszatot kelti, hogy „nem történik semmi”.
     */
    const acceptEntries = (
        entries: UploadEntry[],
        targetId: number | null,
        emptyNotice: string,
    ) => {
        const folderLike = entries.filter((entry) => looksLikeFolder(entry.file));
        const usable = entries.filter((entry) => ! looksLikeFolder(entry.file));

        const names = folderLike
            .slice(0, 3)
            .map((entry) => `„${entry.file.name}”`)
            .join(', ');

        const folderNotice = folderLike.length > 0
            ? `A böngésző ${folderLike.length} mappát (${names}${folderLike.length > 3 ? ' …' : ''}) `
                + 'a tartalma nélkül adott át, ezért kimaradt. Mappát a '
                + '„Feltöltés ▾ → Mappa feltöltése (almappákkal)…” gombbal tud feltölteni: ott azt '
                + 'az EGY mappát válassza ki, amelyik ezeket tartalmazza — a benne lévő almappák és '
                + 'fájlok mind feltöltődnek, a szerkezetükkel együtt.'
            : undefined;

        // Néma csonkítás helyett szóljunk, ha elértük a felső korlátot.
        const capNotice = entries.length >= MAX_ENTRIES
            ? `Egyszerre legfeljebb ${MAX_ENTRIES} fájl kezelhető, a lista ennél le van vágva — `
                + 'a maradékot külön körben töltse fel.'
            : undefined;

        const notice = [folderNotice, capNotice].filter(Boolean).join(' ') || undefined;

        setUpload({
            entries: usable,
            folderId: targetId,
            notice: usable.length > 0 ? notice : (notice ?? emptyNotice),
        });
    };

    /**
     * Mappa feltöltése. Elsődlegesen a natív mappaválasztót használjuk (az adja
     * biztosan a szerkezetet), és csak ha az nincs, esünk vissza a rejtett
     * `webkitdirectory` bemenetre.
     */
    const pickFolder = () => {
        if (! canPickDirectory()) {
            folderInput.current?.click();

            return;
        }

        void entriesFromDirectoryPicker().then((result) => {
            if (result.status === 'cancelled') return;

            if (result.status === 'unavailable') {
                folderInput.current?.click();

                return;
            }

            acceptEntries(
                result.entries,
                folderId,
                'A kiválasztott mappában nem található feltölthető fájl.',
            );
        });
    };

    const onFilesPicked = (list: FileList | null, source: 'file' | 'folder' = 'file') => {
        const entries = entriesFromFiles(list);

        // A fájlválasztó megszakítása is üres listával érkezhet — arra ne nyíljon ablak.
        if (entries.length === 0 && source === 'file') return;

        acceptEntries(
            entries,
            folderId,
            'A kiválasztott mappában nem található feltölthető fájl. Ha a mappa nem üres, '
                + 'elképzelhető, hogy a fájlok csak a felhőben vannak (OneDrive „csak online” '
                + 'állapot) — nyissa meg őket egyszer, hogy helyben is elérhetők legyenek.',
        );
    };

    /* ---------------- navigáció + előzmények ---------------- */
    const visitOptions = {
        preserveScroll: true,
        preserveState: true as const,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };

    const [nav, setNav] = useState(() => readNav());

    // Az előzmény-verem a mappaváltásokat követi (Vissza/Előre gombok).
    useEffect(() => {
        const state = readNav();
        if (state.pending) {
            state.pending = false;
        } else if (state.stack[state.idx] !== folderId) {
            state.stack = [...state.stack.slice(0, state.idx + 1), folderId];
            state.idx = state.stack.length - 1;
        }
        writeNav(state);
        setNav({ ...state });
    }, [folderId]);

    const visitFolder = (id: number | null) => {
        setSelected(new Set());
        setRenaming(null);
        setMenu(null);
        router.get(
            route('documents.index'),
            id ? { folder: id } : {},
            { preserveState: true, preserveScroll: false },
        );
    };

    const goHistory = (delta: number) => {
        const state = readNav();
        const idx = state.idx + delta;
        if (idx < 0 || idx >= state.stack.length) return;
        state.idx = idx;
        state.pending = true;
        writeNav(state);
        visitFolder(state.stack[idx]);
    };

    const parentId = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null;
    const canUp = folderId !== null;

    /* ---------------- műveletek ---------------- */
    const openItem = (item: ExplorerItem) => {
        if (item.type === 'folder') visitFolder(item.row.id);
        else router.get(route('documents.show', item.row.id));
    };

    const currentPath = breadcrumbs.map((c) => c.name).join(' / ');

    const createFolder = (name: string) => {
        router.post(
            route('folders.store'),
            { name, parent_id: newFolderIn?.id ?? null },
            { ...visitOptions, onSuccess: () => setNewFolderIn(null) },
        );
    };

    const applyTemplate = (payload: { template: string; name: string | null }) => {
        router.post(
            route('folders.template'),
            { ...payload, parent_id: templateTarget?.id ?? null },
            { ...visitOptions, onSuccess: () => setTemplateTarget(null) },
        );
    };

    const commitRename = (item: ExplorerItem, name: string) => {
        setRenaming(null);
        if (item.type === 'folder') {
            router.put(route('folders.update', item.row.id), { name }, visitOptions);
        } else {
            router.put(
                route('documents.update', item.row.id),
                { title: name, category: item.row.category },
                visitOptions,
            );
        }
    };

    const bulk = (
        action: 'delete' | 'move' | 'copy',
        refs: { type: 'folder' | 'file'; id: number }[],
        extra: Record<string, unknown> = {},
        onDone?: () => void,
    ) => {
        if (refs.length === 0) return;
        router.post(
            route('file-ops.bulk'),
            { action, items: refs, ...extra },
            {
                ...visitOptions,
                onSuccess: () => {
                    setSelected(new Set());
                    onDone?.();
                },
            },
        );
    };

    const requestDelete = (targets: ExplorerItem[]) => {
        if (targets.length === 0) return;
        const nonEmpty = targets.filter((t) => t.type === 'folder' && t.row.items_count > 0);
        const single = targets.length === 1 ? targets[0] : null;

        setConfirm({
            title: single
                ? single.type === 'folder'
                    ? 'Mappa törlése'
                    : 'Fájl törlése'
                : 'Elemek törlése',
            message: (
                <>
                    <p>
                        {single
                            ? `Biztosan törli a(z) „${nameOf(single)}” ${single.type === 'folder' ? 'mappát' : 'fájlt'}?`
                            : `Biztosan törli a kijelölt ${targets.length} elemet?`}
                    </p>
                    {nonEmpty.length > 0 && (
                        <p className="mt-1.5 font-medium text-coral">
                            {nonEmpty.length === 1
                                ? `A(z) „${nameOf(nonEmpty[0])}” mappa nem üres (${(nonEmpty[0].row as ExplorerFolderRow).items_count} elem) — a teljes tartalma törlődik.`
                                : `${nonEmpty.length} kijelölt mappa nem üres — a teljes tartalmuk törlődik.`}
                        </p>
                    )}
                </>
            ),
            items: targets.map(refOf),
            recursive: nonEmpty.length > 0,
        });
    };

    const putClipboard = (mode: 'copy' | 'cut', targets: ExplorerItem[]) => {
        if (targets.length === 0) return;
        const state: ClipboardState = {
            mode,
            items: targets.map(refOf),
            keys: targets.map(keyOf),
            label: targets.length === 1 ? nameOf(targets[0]) : `${targets.length} elem`,
        };
        setClipboard(state);
        writeClipboard(state);
    };

    const paste = (targetId: number | null = folderId) => {
        const cb = clipboard;
        if (!cb) return;
        bulk(cb.mode === 'cut' ? 'move' : 'copy', cb.items, { target_id: targetId }, () => {
            if (cb.mode === 'cut') {
                setClipboard(null);
                writeClipboard(null);
            }
        });
    };

    const startRename = (item?: ExplorerItem) => {
        const target = item ?? selectedItems[0];
        if (!target) return;
        selectOnly(keyOf(target));
        setRenaming(keyOf(target));
    };

    const refresh = () => router.reload();

    /**
     * Megnyitás asztali Office-ban: kérünk egy rövid életű megnyitó
     * hivatkozást, azt pedig átadjuk a rendszernek — a Windows innen indítja a
     * telepített Wordöt/Excelt, és mentéskor az új verzió ide jön vissza.
     */
    const openInOffice = async (documentId: number) => {
        try {
            const { data } = await window.axios.post(route('documents.office', documentId));

            if (! data.secure) {
                setInfo({
                    title: 'Csak HTTPS-en működik',
                    message:
                        'Az Office csak biztonságos (https) címről nyitja meg és menti a fájlt. '
                        + 'Használja az éles címet (cloud.acuwall.hu).',
                });

                return;
            }

            window.location.href = data.uri as string;

            setInfo({
                title: `${data.app} indítása`,
                message: data.editable
                    ? `A(z) „${data.filename}” megnyílik a(z) ${data.app} programban. `
                        + 'Ha ott menti, a fájl ÚJ VERZIÓKÉNT kerül vissza ide — az oldalt frissítve látja.'
                    : `A(z) „${data.filename}” csak megtekintésre nyílik meg: ebbe a mappába nincs `
                        + 'szerkesztési jogosultsága.',
            });
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } }).response?.data
                ?.message;

            setInfo({
                title: 'A megnyitás nem sikerült',
                message: message ?? 'A megnyitó hivatkozást nem sikerült elkészíteni.',
            });
        }
    };

    /* ---------------- helyi menük ---------------- */
    const openMenuAt = (
        x: number,
        y: number,
        entries: MenuEntry[],
        quick?: QuickAction[],
    ) => setMenu({ x, y, entries, quick });

    const viewSubmenu = (): MenuEntry[] =>
        (
            [
                ['xl', Maximize2],
                ['large', Grid2x2],
                ['medium', LayoutGrid],
                ['tiles', Rows3],
                ['list', List],
                ['details', Table2],
            ] as const
        ).map(([mode, icon]) => ({
            label: VIEW_LABELS[mode],
            icon,
            checked: view === mode,
            onClick: () => setView(mode),
        }));

    const sortSubmenu = (): MenuEntry[] => [
        ...(Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
            label: SORT_LABELS[key],
            checked: sort.key === key,
            onClick: () => setSort((prev) => ({ ...prev, key })),
        })),
        { separator: true },
        {
            label: 'Növekvő',
            checked: sort.dir === 'asc',
            onClick: () => setSort((prev) => ({ ...prev, dir: 'asc' })),
        },
        {
            label: 'Csökkenő',
            checked: sort.dir === 'desc',
            onClick: () => setSort((prev) => ({ ...prev, dir: 'desc' })),
        },
    ];

    /** Feltöltés-menüpontok: a parancssáv gombja és az „Új” menü is ezt mutatja. */
    const uploadSubmenu = (): MenuEntry[] => [
        {
            label: 'Fájlok feltöltése…',
            icon: Upload,
            disabled: !can.create,
            onClick: () => fileInput.current?.click(),
        },
        {
            label: 'Mappa feltöltése (almappákkal)…',
            icon: FolderUp,
            disabled: !can.create,
            onClick: pickFolder,
        },
        ...(coarse
            ? ([
                  {
                      label: 'Kép a galériából',
                      icon: ImageIcon,
                      disabled: !can.create,
                      onClick: () => galleryInput.current?.click(),
                  },
                  {
                      label: 'Fényképezés',
                      icon: Camera,
                      disabled: !can.create,
                      onClick: () => cameraInput.current?.click(),
                  },
              ] as MenuEntry[])
            : []),
    ];

    const newSubmenu = (targetId: number | null, path: string): MenuEntry[] => [
        {
            label: 'Mappa',
            icon: FolderPlus,
            shortcut: 'Ctrl+Shift+N',
            disabled: !can.create,
            onClick: () => setNewFolderIn({ id: targetId }),
        },
        {
            label: 'Mappastruktúra sablonból…',
            icon: LayoutTemplate,
            disabled: !can.create,
            onClick: () => setTemplateTarget({ id: targetId, path }),
        },
        { separator: true },
        ...uploadSubmenu(),
    ];

    /** Üres területre (háttérre) nyíló menü — mint az Intéző mappa-háttere. */
    const backgroundMenu = (): MenuEntry[] => [
        { label: 'Nézet', icon: LayoutGrid, submenu: viewSubmenu() },
        { label: 'Rendezés', icon: ArrowUpDown, submenu: sortSubmenu() },
        { label: 'Frissítés', icon: RefreshCw, shortcut: 'F5', onClick: refresh },
        { separator: true },
        {
            label: 'Beillesztés',
            icon: ClipboardPaste,
            shortcut: 'Ctrl+V',
            disabled: !clipboard || !can.create || searchMode,
            onClick: () => paste(),
        },
        { separator: true },
        {
            label: 'Új',
            icon: FolderPlus,
            submenu: newSubmenu(folderId, currentPath),
            disabled: !can.create || searchMode,
        },
        { separator: true },
        {
            label: 'Tulajdonságok',
            icon: Info,
            shortcut: 'Alt+Enter',
            disabled: !currentFolder,
            onClick: () =>
                currentFolder && setPropsTarget({ type: 'folder', id: currentFolder.id }),
        },
    ];

    /** Elemre nyíló menü (a kijelölés egészére vonatkozik). */
    const itemMenu = (item: ExplorerItem, targets: ExplorerItem[]): MenuEntry[] => {
        const many = targets.length > 1;
        const isFolder = item.type === 'folder';

        return [
            {
                label: many ? `Megnyitás (${targets.length})` : 'Megnyitás',
                icon: isFolder ? FolderOpen : ExternalLink,
                disabled: many,
                onClick: () => openItem(item),
            },
            ...(!isFolder && officeAppFor((item.row as ExplorerFileRow).original_filename)
                ? ([
                      {
                          label: openInAppLabel(
                              officeAppFor((item.row as ExplorerFileRow).original_filename) ?? '',
                          ),
                          icon: AppWindow,
                          disabled: many,
                          onClick: () => openInOffice(item.row.id),
                      },
                  ] as MenuEntry[])
                : []),
            ...(!isFolder
                ? ([
                      {
                          label: 'Letöltés',
                          icon: Download,
                          disabled: many || !(item.row as ExplorerFileRow).download_version_id,
                          onClick: () => {
                              const id = (item.row as ExplorerFileRow).download_version_id;
                              if (id) window.location.href = route('documents.versions.download', id);
                          },
                      },
                  ] as MenuEntry[])
                : []),
            { separator: true },
            {
                label: 'Kivágás',
                icon: Scissors,
                shortcut: 'Ctrl+X',
                disabled: !can.edit,
                onClick: () => putClipboard('cut', targets),
            },
            {
                label: 'Másolás',
                icon: Copy,
                shortcut: 'Ctrl+C',
                onClick: () => putClipboard('copy', targets),
            },
            ...(isFolder
                ? ([
                      {
                          label: 'Beillesztés a mappába',
                          icon: ClipboardPaste,
                          disabled: !clipboard || many,
                          onClick: () => paste(item.row.id),
                      },
                  ] as MenuEntry[])
                : []),
            {
                label: 'Áthelyezés…',
                icon: FolderInput,
                disabled: !can.edit,
                onClick: () => setMoveTargets(targets),
            },
            ...(isFolder
                ? ([
                      {
                          label: 'Új',
                          icon: FolderPlus,
                          disabled: many || !can.create,
                          submenu: newSubmenu(item.row.id, `${currentPath} / ${nameOf(item)}`),
                      },
                  ] as MenuEntry[])
                : []),
            { separator: true },
            {
                label: 'Átnevezés',
                icon: Pencil,
                shortcut: 'F2',
                disabled: many || !can.edit,
                onClick: () => startRename(item),
            },
            {
                label: many ? `Törlés (${targets.length})` : 'Törlés',
                icon: Trash2,
                shortcut: 'Del',
                danger: true,
                disabled: !can.delete,
                onClick: () => requestDelete(targets),
            },
            { separator: true },
            {
                label: 'Tulajdonságok',
                icon: Info,
                shortcut: 'Alt+Enter',
                disabled: many,
                onClick: () => setPropsTarget({ type: item.type, id: item.row.id }),
            },
        ];
    };

    const itemQuick = (item: ExplorerItem, targets: ExplorerItem[]): QuickAction[] => [
        {
            label: 'Kivágás',
            icon: Scissors,
            disabled: !can.edit,
            onClick: () => putClipboard('cut', targets),
        },
        { label: 'Másolás', icon: Copy, onClick: () => putClipboard('copy', targets) },
        {
            label: 'Átnevezés',
            icon: Pencil,
            disabled: targets.length > 1 || !can.edit,
            onClick: () => startRename(item),
        },
        {
            label: 'Tulajdonságok',
            icon: Info,
            disabled: targets.length > 1,
            onClick: () => setPropsTarget({ type: item.type, id: item.row.id }),
        },
        {
            label: 'Törlés',
            icon: Trash2,
            danger: true,
            disabled: !can.delete,
            onClick: () => requestDelete(targets),
        },
    ];

    const moreMenu = (): MenuEntry[] => [
        {
            label: 'Összes kijelölése',
            icon: CheckCheck,
            shortcut: 'Ctrl+A',
            onClick: () => setSelected(new Set(items.map(keyOf))),
        },
        {
            label: 'Kijelölés megszüntetése',
            disabled: selected.size === 0,
            onClick: () => setSelected(new Set()),
        },
        { separator: true },
        {
            label: 'Mappastruktúra sablonból…',
            icon: LayoutTemplate,
            disabled: !can.create || searchMode,
            onClick: () => setTemplateTarget({ id: folderId, path: currentPath }),
        },
        { label: 'Frissítés', icon: RefreshCw, shortcut: 'F5', onClick: refresh },
        { separator: true },
        {
            label: 'Tulajdonságok',
            icon: Info,
            shortcut: 'Alt+Enter',
            disabled: !currentFolder && selectedItems.length !== 1,
            onClick: () => {
                if (selectedItems.length === 1) {
                    setPropsTarget({
                        type: selectedItems[0].type,
                        id: selectedItems[0].row.id,
                    });
                } else if (currentFolder) {
                    setPropsTarget({ type: 'folder', id: currentFolder.id });
                }
            },
        },
    ];

    const openBarMenu = (e: React.MouseEvent, entries: MenuEntry[]) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        openMenuAt(rect.left, rect.bottom + 4, entries);
    };

    /* ---------------- húzás–ejtés ---------------- */
    const [dropKey, setDropKey] = useState<string | null>(null);
    const [fileDrag, setFileDrag] = useState(false);
    const dragging = useRef(false);

    const dropInto = (targetId: number | null, e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDropKey(null);
        setFileDrag(false);

        // Az operációs rendszerből behúzott fájlok/mappák: a mappákat
        // almappástul bejárjuk (a DataTransfer csak szinkron olvasható).
        if (e.dataTransfer.types.includes('Files')) {
            void entriesFromDrop(e.dataTransfer)
                .then((entries) =>
                    acceptEntries(
                        entries,
                        targetId,
                        'A behúzott elemekből nem sikerült fájlt beolvasni (üres mappa, vagy a '
                            + 'fájlok csak a felhőben érhetők el).',
                    ),
                )
                .catch((err: unknown) =>
                    setUpload({
                        entries: [],
                        folderId: targetId,
                        notice: 'Nem sikerült beolvasni a behúzott elemeket: '
                            + ((err as Error)?.message ?? 'ismeretlen hiba')
                            + '. Próbálja a „Feltöltés ▾ → Mappa feltöltése (almappákkal)…” gombot.',
                    }),
                );

            return;
        }

        const raw = e.dataTransfer.getData('application/x-octopus-items');
        if (!raw) return;
        try {
            const refs = JSON.parse(raw) as { type: 'folder' | 'file'; id: number }[];
            const copy = e.ctrlKey;
            // Ugyanabba a mappába ejtve nincs teendő (kivéve Ctrl = másolat).
            if (targetId === folderId && !copy) return;
            bulk(copy ? 'copy' : 'move', refs, { target_id: targetId });
        } catch {
            /* nem a mi hasznos terhünk */
        }
    };

    const acceptsDrag = (e: React.DragEvent) =>
        e.dataTransfer.types.includes('application/x-octopus-items') ||
        e.dataTransfer.types.includes('Files');

    const dropTargetProps = (id: number | null, key: string) => ({
        onDragOver: (e: React.DragEvent) => {
            if (!acceptsDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
            setDropKey(key);
        },
        onDragLeave: () => setDropKey((prev) => (prev === key ? null : prev)),
        onDrop: (e: React.DragEvent) => dropInto(id, e),
    });

    /* ---------------- gumikeretes kijelölés ---------------- */
    const surfaceRef = useRef<HTMLDivElement>(null);
    const [marquee, setMarquee] = useState<{
        left: number;
        top: number;
        width: number;
        height: number;
    } | null>(null);

    const onSurfaceMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0 || coarse) return;
        const target = e.target as HTMLElement;
        if (target.closest('[data-key]') || target.closest('input,button,select,a')) return;

        const additive = e.ctrlKey || e.metaKey;
        const base = additive ? new Set(selected) : new Set<ItemKey>();
        if (!additive) setSelected(new Set());

        const x0 = e.clientX;
        const y0 = e.clientY;
        let moved = false;

        const move = (ev: MouseEvent) => {
            const dx = Math.abs(ev.clientX - x0);
            const dy = Math.abs(ev.clientY - y0);
            if (!moved && dx < 4 && dy < 4) return;
            moved = true;

            const rect = {
                left: Math.min(x0, ev.clientX),
                top: Math.min(y0, ev.clientY),
                width: dx,
                height: dy,
            };
            setMarquee(rect);

            const box = new DOMRect(rect.left, rect.top, rect.width, rect.height);
            const next = new Set(base);
            surfaceRef.current?.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
                if (intersects(el.getBoundingClientRect(), box)) {
                    next.add(el.dataset.key as ItemKey);
                }
            });
            setSelected(next);
        };

        const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            setMarquee(null);
        };

        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };

    /* ---------------- elem-események ---------------- */
    const handlers: ItemHandlers = {
        onMouseDown: (item, e) => {
            const key = keyOf(item);
            if (e.button === 2) {
                if (!selected.has(key)) selectOnly(key);
                return;
            }
            if (e.shiftKey && anchor) {
                e.preventDefault();
                selectRange(anchor, key);
            } else if (e.ctrlKey || e.metaKey) {
                setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                });
                setAnchor(key);
            } else if (!selected.has(key)) {
                selectOnly(key);
            }
        },
        onClick: (item, e) => {
            if (e.shiftKey || e.ctrlKey || e.metaKey) return;
            if (dragging.current) return;
            if (coarse) {
                openItem(item);
                return;
            }
            selectOnly(keyOf(item));
        },
        onDoubleClick: (item) => openItem(item),
        onContextMenu: (item, e) => {
            e.preventDefault();
            e.stopPropagation();
            const key = keyOf(item);
            const targets = selected.has(key) ? selectedItems : [item];
            if (!selected.has(key)) selectOnly(key);
            openMenuAt(e.clientX, e.clientY, itemMenu(item, targets), itemQuick(item, targets));
        },
        onDragStart: (item, e) => {
            const key = keyOf(item);
            let targets = selectedItems;
            if (!selected.has(key)) {
                selectOnly(key);
                targets = [item];
            }
            dragging.current = true;
            e.dataTransfer.setData(
                'application/x-octopus-items',
                JSON.stringify(targets.map(refOf)),
            );
            e.dataTransfer.effectAllowed = 'copyMove';
        },
        onDragEnd: () => {
            dragging.current = false;
            setDropKey(null);
        },
        onFolderDragOver: (item, e) => {
            if (!acceptsDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
            setDropKey(keyOf(item));
        },
        onFolderDragLeave: () => setDropKey(null),
        onFolderDrop: (item, e) => dropInto(item.row.id, e),
        onRenameCommit: commitRename,
        onRenameCancel: () => setRenaming(null),
    };

    /* ---------------- gyorsbillentyűk ---------------- */
    const typeBuffer = useRef({ text: '', at: 0 });

    const onKey = useCallback(
        (e: KeyboardEvent) => {
            if (dialogOpen || menu || renaming) return;
            const active = document.activeElement as HTMLElement | null;
            if (
                active &&
                (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) ||
                    active.isContentEditable)
            ) {
                return;
            }

            const ctrl = e.ctrlKey || e.metaKey;

            if (ctrl && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                setSelected(new Set(items.map(keyOf)));
                return;
            }
            if (ctrl && e.shiftKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                if (can.create) setNewFolderIn({ id: folderId });
                return;
            }
            if (ctrl && e.key.toLowerCase() === 'c') {
                putClipboard('copy', selectedItems);
                return;
            }
            if (ctrl && e.key.toLowerCase() === 'x') {
                if (can.edit) putClipboard('cut', selectedItems);
                return;
            }
            if (ctrl && e.key.toLowerCase() === 'v') {
                if (can.create && !searchMode) paste();
                return;
            }
            if (e.key === 'Delete') {
                if (can.delete) requestDelete(selectedItems);
                return;
            }
            if (e.key === 'F2') {
                e.preventDefault();
                if (can.edit) startRename();
                return;
            }
            if (e.key === 'F5') {
                e.preventDefault();
                refresh();
                return;
            }
            if (e.key === 'Enter') {
                if (e.altKey) {
                    e.preventDefault();
                    if (selectedItems.length === 1) {
                        setPropsTarget({
                            type: selectedItems[0].type,
                            id: selectedItems[0].row.id,
                        });
                    } else if (currentFolder) {
                        setPropsTarget({ type: 'folder', id: currentFolder.id });
                    }
                } else if (selectedItems.length === 1) {
                    openItem(selectedItems[0]);
                }
                return;
            }
            if (e.key === 'Escape') {
                setSelected(new Set());
                return;
            }
            if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) {
                e.preventDefault();
                if (canUp) visitFolder(parentId);
                return;
            }
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                goHistory(-1);
                return;
            }
            if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                goHistory(1);
                return;
            }

            // Kezdőbetűre ugrás (Intéző-szerű típus-kereső).
            if (!ctrl && !e.altKey && e.key.length === 1 && /\S/.test(e.key)) {
                const now = Date.now();
                const buffer = now - typeBuffer.current.at < 900 ? typeBuffer.current.text : '';
                const text = (buffer + e.key).toLowerCase();
                typeBuffer.current = { text, at: now };

                const match =
                    items.find((i) => nameOf(i).toLowerCase().startsWith(text)) ??
                    (text.length > 1
                        ? items.find((i) => nameOf(i).toLowerCase().startsWith(e.key.toLowerCase()))
                        : undefined);

                if (match) {
                    selectOnly(keyOf(match));
                    surfaceRef.current
                        ?.querySelector(`[data-key="${keyOf(match)}"]`)
                        ?.scrollIntoView({ block: 'nearest' });
                }
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [dialogOpen, menu, renaming, items, selectedItems, clipboard, can, folderId, searchMode],
    );

    useEffect(() => {
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onKey]);

    /* ---------------- keresés ---------------- */
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        const t = setTimeout(() => {
            router.get(
                route('documents.index'),
                {
                    ...(search ? { search } : {}),
                    ...(!search && folderId ? { folder: folderId } : {}),
                },
                { preserveState: true, replace: true },
            );
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    /* ================================================================== */

    return (
        <>
            <Head title="Fájlkezelő" />

            <PageHeader
                title="Fájlkezelő"
                subtitle="Mappák, tervrajzok, engedélyek, fotók — verziókövetéssel és hozzáférés-kezeléssel."
            />

            {/* Rejtett fájl-bemenetek: fájl / galéria / kamera */}
            <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                }}
            />
            <input
                ref={folderInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                    onFilesPicked(e.target.files, 'folder');
                    e.target.value = '';
                }}
            />
            <input
                ref={galleryInput}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                }}
            />
            <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                    onFilesPicked(e.target.files);
                    e.target.value = '';
                }}
            />

            <div className="o-card overflow-hidden">
                <AddressBar
                    breadcrumbs={breadcrumbs}
                    tree={tree}
                    restricted={!!currentFolder?.is_restricted}
                    canBack={nav.idx > 0}
                    canForward={nav.idx >= 0 && nav.idx < nav.stack.length - 1}
                    canUp={canUp}
                    onBack={() => goHistory(-1)}
                    onForward={() => goHistory(1)}
                    onUp={() => visitFolder(parentId)}
                    onRefresh={refresh}
                    onNavigate={visitFolder}
                    search={search}
                    onSearchChange={setSearch}
                    searchMode={searchMode}
                    resultCount={documents.length}
                    onClearSearch={() => {
                        setSearch('');
                        visitFolder(folderId);
                    }}
                    dropKey={dropKey}
                    crumbDropProps={(id) => dropTargetProps(id, `crumb-${id ?? 'root'}`)}
                />

                <CommandBar
                    can={can}
                    coarse={coarse}
                    searchMode={searchMode}
                    selectionCount={selected.size}
                    clipboardCount={clipboard?.items.length ?? 0}
                    onNewMenu={(e) => openBarMenu(e, newSubmenu(folderId, currentPath))}
                    onUploadMenu={(e) => openBarMenu(e, uploadSubmenu())}
                    onSortMenu={(e) => openBarMenu(e, sortSubmenu())}
                    onViewMenu={(e) => openBarMenu(e, viewSubmenu())}
                    onMoreMenu={(e) => openBarMenu(e, moreMenu())}
                    onCut={() => putClipboard('cut', selectedItems)}
                    onCopy={() => putClipboard('copy', selectedItems)}
                    onPaste={() => paste()}
                    onRename={() => startRename()}
                    onDelete={() => requestDelete(selectedItems)}
                    onGallery={() => galleryInput.current?.click()}
                    onCamera={() => cameraInput.current?.click()}
                />

                {/* Törzs: mappafa + tartalom */}
                <div className="flex">
                    <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-line p-2 lg:block">
                        <FolderTree
                            tree={tree}
                            selectedId={folderId}
                            onSelect={visitFolder}
                            dropTarget={
                                dropKey?.startsWith('tree-')
                                    ? dropKey === 'tree-root'
                                        ? null
                                        : Number(dropKey.slice(5))
                                    : 'none'
                            }
                            onNodeDragOver={(id, e) => {
                                if (!acceptsDrag(e)) return;
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
                                setDropKey(`tree-${id ?? 'root'}`);
                            }}
                            onNodeDragLeave={() => setDropKey(null)}
                            onNodeDrop={(id, e) => dropInto(id, e)}
                            onContextMenu={(id, e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const node = tree.find((f) => f.id === id);
                                const path = node ? node.name : 'Fájlok';
                                openMenuAt(e.clientX, e.clientY, [
                                    {
                                        label: 'Megnyitás',
                                        icon: FolderOpen,
                                        onClick: () => visitFolder(id),
                                    },
                                    { separator: true },
                                    {
                                        label: 'Új',
                                        icon: FolderPlus,
                                        disabled: !can.create,
                                        submenu: newSubmenu(id, path),
                                    },
                                    {
                                        label: 'Beillesztés',
                                        icon: ClipboardPaste,
                                        disabled: !clipboard,
                                        onClick: () => paste(id),
                                    },
                                    { separator: true },
                                    {
                                        label: 'Tulajdonságok',
                                        icon: Info,
                                        disabled: id === null,
                                        onClick: () =>
                                            id !== null && setPropsTarget({ type: 'folder', id }),
                                    },
                                ]);
                            }}
                        />
                    </aside>

                    <div
                        ref={surfaceRef}
                        className={clsx(
                            'relative min-h-[440px] flex-1 overflow-auto p-3',
                            fileDrag && 'bg-accent-50/40 ring-2 ring-inset ring-accent/30',
                        )}
                        onMouseDown={onSurfaceMouseDown}
                        onContextMenu={(e) => {
                            if ((e.target as HTMLElement).closest('[data-key]')) return;
                            e.preventDefault();
                            e.stopPropagation();
                            setSelected(new Set());
                            openMenuAt(e.clientX, e.clientY, backgroundMenu());
                        }}
                        onDragOver={(e) => {
                            if (!acceptsDrag(e)) return;
                            e.preventDefault();
                            if (e.dataTransfer.types.includes('Files')) setFileDrag(true);
                        }}
                        onDragLeave={(e) => {
                            if (e.target === e.currentTarget) setFileDrag(false);
                        }}
                        onDrop={(e) => dropInto(folderId, e)}
                    >
                        {items.length === 0 ? (
                            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                                <FolderIcon
                                    size={52}
                                    className="text-[#E8B04B]"
                                    fill="#F3CE84"
                                    strokeWidth={1}
                                />
                                <p className="mt-3 text-sm font-medium text-ink-soft">
                                    {searchMode ? 'Nincs találat.' : 'Ez a mappa üres.'}
                                </p>
                                {!searchMode && can.create && (
                                    <p className="mt-1 max-w-sm text-xs text-ink-faint">
                                        Kattintson jobb gombbal az üres területre az „Új” menühöz,
                                        vagy húzzon ide fájlokat és mappákat a számítógépéről.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <ItemView
                                items={items}
                                view={view}
                                sort={sort}
                                onSort={(key) =>
                                    setSort((prev) =>
                                        prev.key === key
                                            ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                                            : { key, dir: 'asc' },
                                    )
                                }
                                selected={selected}
                                cutKeys={cutKeys}
                                renaming={renaming}
                                dropTarget={dropKey}
                                searchMode={searchMode}
                                canDrag={can.edit}
                                showMenuButton={coarse}
                                handlers={handlers}
                            />
                        )}

                        {fileDrag && (
                            <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-[6px] border-2 border-dashed border-accent/50 bg-white/70">
                                <span className="flex items-center gap-2 text-sm font-medium text-accent-700">
                                    <Upload size={18} />
                                    Fájlok feltöltése ide
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Állapotsor */}
                <div className="flex items-center justify-between gap-3 border-t border-line bg-cream/40 px-3 py-1 text-[11px] text-ink-faint">
                    <span className="truncate">
                        {items.length} elem
                        {selected.size > 0 && (
                            <>
                                {' · '}
                                {selected.size} elem kijelölve
                                {selectedSize > 0 && ` (${fmtBytes(selectedSize)})`}
                            </>
                        )}
                        {clipboard && (
                            <>
                                {' · '}
                                Vágólapon: {clipboard.label} (
                                {clipboard.mode === 'cut' ? 'kivágva' : 'másolva'})
                            </>
                        )}
                        {busy && ' · dolgozom…'}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                        <button
                            onClick={() => setView('medium')}
                            aria-label="Ikonok"
                            title="Ikonok"
                            className={clsx(
                                'rounded-[3px] p-1',
                                view !== 'details' && view !== 'list'
                                    ? 'bg-accent text-white'
                                    : 'text-ink-faint hover:text-ink',
                            )}
                        >
                            <LayoutGrid size={13} />
                        </button>
                        <button
                            onClick={() => setView('details')}
                            aria-label="Részletek"
                            title="Részletek"
                            className={clsx(
                                'rounded-[3px] p-1',
                                view === 'details'
                                    ? 'bg-accent text-white'
                                    : 'text-ink-faint hover:text-ink',
                            )}
                        >
                            <Table2 size={13} />
                        </button>
                    </span>
                </div>
            </div>

            {/* Gumikeret */}
            {marquee && (
                <div
                    className="pointer-events-none fixed z-40 rounded-[2px] border border-accent/60 bg-accent/10"
                    style={marquee}
                />
            )}

            {/* Helyi menü */}
            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    items={menu.entries}
                    quick={menu.quick}
                    onClose={() => setMenu(null)}
                />
            )}

            {/* Párbeszédek */}
            <TemplateDialog
                open={templateTarget !== null}
                templates={folderTemplates}
                targetPath={templateTarget?.path || 'Fájlok'}
                projects={projects}
                busy={busy}
                onSubmit={applyTemplate}
                onClose={() => setTemplateTarget(null)}
            />

            <NameDialog
                open={newFolderIn !== null}
                title="Új mappa"
                label="A mappa neve"
                initial="Új mappa"
                submitLabel="Létrehozás"
                error={pageErrors.name}
                busy={busy}
                onSubmit={createFolder}
                onClose={() => setNewFolderIn(null)}
            />

            {moveTargets && (
                <MoveDialog
                    open
                    itemName={
                        moveTargets.length === 1
                            ? nameOf(moveTargets[0])
                            : `${moveTargets.length} elem`
                    }
                    tree={tree}
                    movingFolderId={
                        moveTargets.length === 1 && moveTargets[0].type === 'folder'
                            ? moveTargets[0].row.id
                            : null
                    }
                    currentLocation={folderId}
                    busy={busy}
                    onMove={(target) =>
                        bulk('move', moveTargets.map(refOf), { target_id: target }, () =>
                            setMoveTargets(null),
                        )
                    }
                    onClose={() => setMoveTargets(null)}
                />
            )}

            <PropertiesDialog
                target={propsTarget}
                users={users}
                onNavigate={setPropsTarget}
                onClose={() => setPropsTarget(null)}
            />

            <ConfirmDialog
                open={confirm !== null}
                title={confirm?.title ?? ''}
                message={confirm?.message}
                confirmLabel="Törlés"
                busy={busy}
                onConfirm={() => {
                    if (!confirm) return;
                    bulk('delete', confirm.items, { recursive: confirm.recursive }, () =>
                        setConfirm(null),
                    );
                }}
                onClose={() => setConfirm(null)}
            />

            <ConfirmDialog
                open={info !== null}
                title={info?.title ?? ''}
                message={info?.message}
                confirmLabel="Rendben"
                danger={false}
                cancelLabel={null}
                onConfirm={() => setInfo(null)}
                onClose={() => setInfo(null)}
            />

            <UploadDialog
                open={upload !== null}
                entries={upload?.entries ?? []}
                notice={upload?.notice}
                folderId={upload?.folderId ?? null}
                categories={categories}
                projects={projects}
                onClose={() => setUpload(null)}
            />
        </>
    );
}

Index.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
