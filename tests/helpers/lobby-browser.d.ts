interface Window {
   lobbyDocumentMarker: string;
   lobbyIdentity: string;
   perfDocument: string;
   perfTarget: string | null;
   perfSamples: { label: string; mutationAt: number; frameAt: number }[];
}
