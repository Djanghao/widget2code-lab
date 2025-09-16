"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WidgetPane } from "@/components/widget-pane";
import { WidgetPreview } from "@/components/widget-preview";

type Experiment = {
  provider: string;
  size: string;
  id: string;
  fullPath: string;
  imageUrl?: string;
  minimalHtml?: string;
  detailedHtml?: string;
  minimalRaw?: string;
  detailedRaw?: string;
};

type DataSet = { rootLabel: string; experiments: Experiment[] };

type ComparisonPane = {
  key: string;
  title: string;
  content: React.ReactNode | null;
  emptyMessage?: string;
};

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot) : "";
}

export default function Page() {
  const [data, setData] = React.useState<DataSet | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = React.useRef<string[]>([]);

  const resetObjectUrls = React.useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  React.useEffect(() => {
    return () => {
      resetObjectUrls();
    };
  }, [resetObjectUrls]);

  async function parseFolder(files: FileList): Promise<DataSet> {
    const allFiles = Array.from(files);
    if (allFiles.length === 0) {
      throw new Error("No files selected");
    }

    const experimentsMap = new Map<string, Experiment>();
    const newObjectUrls: string[] = [];
    let rootLabel = "";

    for (const file of allFiles) {
      const relPathRaw = file.webkitRelativePath || file.name;
      const relPath = relPathRaw.replace(/\\/g, "/");
      const parts = relPath.split("/").filter(Boolean);
      if (parts.length < 4) continue;
      const [maybeRoot, provider, size, id, ...rest] = parts;
      if (!rootLabel) rootLabel = maybeRoot;
      if (!provider || !size || !id) continue;

      const key = `${provider}|||${size}|||${id}`;
      let experiment = experimentsMap.get(key);
      if (!experiment) {
        experiment = {
          provider,
          size,
          id,
          fullPath: `${provider}/${size}/${id}`,
        };
        experimentsMap.set(key, experiment);
      }

      if (rest.length === 0) continue;
      const fileName = rest[rest.length - 1]?.toLowerCase();
      if (!fileName) continue;

      const ext = getExtension(fileName);
      if (rest.length === 1 && IMAGE_EXTENSIONS.has(ext)) {
        const url = URL.createObjectURL(file);
        experiment.imageUrl = url;
        newObjectUrls.push(url);
        continue;
      }

      const scope = rest[0]?.toLowerCase();
      if (scope !== "minimal" && scope !== "detailed") continue;

      if (fileName.endsWith(".html")) {
        const html = await file.text();
        if (scope === "minimal") experiment.minimalHtml = html;
        else experiment.detailedHtml = html;
      } else if (fileName.endsWith(".raw.txt")) {
        const text = await file.text();
        if (scope === "minimal") experiment.minimalRaw = text;
        else experiment.detailedRaw = text;
      }
    }

    const experiments = Array.from(experimentsMap.values()).filter(
      (exp) => exp.imageUrl || exp.minimalHtml || exp.detailedHtml
    );
    experiments.sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) ||
        a.size.localeCompare(b.size) ||
        a.id.localeCompare(b.id)
    );

    if (experiments.length === 0) {
      newObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      throw new Error("No experiments found. Ensure the folder structure matches provider/size/id.");
    }

    if (!rootLabel) rootLabel = "upload";
    objectUrlsRef.current = newObjectUrls;
    return { rootLabel, experiments };
  }

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) return;
    setProcessing(true);
    setError(null);
    try {
      resetObjectUrls();
      const dataSet = await parseFolder(files);
      setData(dataSet);
      setSelectedIndex(0);
    } catch (e: any) {
      setData(null);
      setSelectedIndex(0);
      setError(e?.message || String(e));
    } finally {
      setProcessing(false);
    }
  };

  const openFolderPicker = () => {
    fileInputRef.current?.click();
  };

  const exp = data?.experiments?.[selectedIndex];

  const comparisons = React.useMemo<ComparisonPane[]>(() => {
    if (!exp) return [];
    const panes: ComparisonPane[] = [];

    const imageContent = exp.imageUrl
      ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exp.imageUrl}
            alt={exp.id}
            style={{ display: "block" }}
          />
        )
      : null;

    panes.push({
      key: "original",
      title: "Original",
      content: imageContent,
      emptyMessage: "Image not found",
    });

    panes.push({
      key: "detailed",
      title: "Detailed",
      content: exp.detailedHtml ? <WidgetPane html={exp.detailedHtml} /> : null,
      emptyMessage: "Detailed HTML not found",
    });

    panes.push({
      key: "minimal",
      title: "Minimal",
      content: exp.minimalHtml ? <WidgetPane html={exp.minimalHtml} /> : null,
      emptyMessage: exp.minimalHtml ? undefined : "Minimal HTML not found",
    });

    return panes;
  }, [exp]);

  return (
    <div className="flex h-screen flex-col bg-white text-slate-900">
      <header className="flex items-center border-b border-slate-200 bg-white px-6 py-4 text-sm">
        <div className="text-lg font-semibold tracking-tight">Results Viewer</div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-xs text-slate-500">
            {data ? `Folder: ${data.rootLabel}` : "Select a folder containing experiments"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFolderSelect}
            // @ts-ignore webkitdirectory is not yet in the type definitions
            webkitdirectory="true"
          />
          <Button onClick={openFolderPicker} disabled={processing}>
            {processing ? "Processing..." : data ? "Choose Another Folder" : "Choose Folder"}
          </Button>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="w-80 border-r border-slate-200 bg-white">
          <Card className="h-full rounded-none border-0 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Experiments {data ? `(${data.experiments.length})` : ""}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-4 pt-0">
              {error ? (
                <div className="px-3 text-sm text-red-600">{error}</div>
              ) : (
                <ScrollArea className="h-[calc(100vh-160px)]">
                  <ul className="space-y-1 pr-3">
                    {data?.experiments.map((e, i) => {
                      const active = i === selectedIndex;
                      return (
                        <li key={`${e.provider}-${e.size}-${e.id}`}>
                          <button
                            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                              active
                                ? "border-slate-400 bg-slate-100 text-slate-900"
                                : "border-transparent hover:border-slate-200 hover:bg-slate-100"
                            }`}
                            onClick={() => setSelectedIndex(i)}
                            title={e.fullPath}
                          >
                            <div className="truncate font-medium">{e.id}</div>
                            <div className="truncate text-xs text-slate-500">{e.provider} · {e.size}</div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col overflow-auto bg-white">
          {exp ? (
            <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-6">
              <div className="flex shrink-0 flex-col gap-1">
                <div className="text-xs uppercase tracking-wide text-slate-500">{exp.provider} · {exp.size}</div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{exp.id}</h2>
                <div className="truncate text-xs text-slate-500" title={exp.fullPath}>
                  {exp.fullPath}
                </div>
              </div>
              <div className="flex flex-1 min-h-0 gap-6 pb-10">
                {comparisons.map((pane) => (
                  <Card key={pane.key} className="flex min-w-0 flex-1 flex-col border border-slate-200 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-medium text-slate-900">{pane.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-1 min-h-0 flex-col border-t border-slate-200 bg-white p-0">
                      {pane.content ? (
                        <WidgetPreview>
                          {pane.content}
                        </WidgetPreview>
                      ) : (
                        <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
                          {pane.emptyMessage}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              {error ? "Please choose a valid folder" : "Use the button above to choose a folder"}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
