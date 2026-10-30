import React, { useState, useEffect, useMemo } from 'react';

export interface GalleryImageItem {
  id: string;
  date: string;
  url: string;
  label: string;
}

interface HDGalleryPreviewProps {
  images: GalleryImageItem[];
  onOpenZoomModal: (url: string) => void;
  onRequestDelete: (id: string) => void;
  onUploadClick: () => void;
  isOptimizing: boolean;
  patientName?: string;
}

const HDGalleryPreview: React.FC<HDGalleryPreviewProps> = ({
  images,
  onOpenZoomModal,
  onRequestDelete,
  onUploadClick,
  isOptimizing,
  patientName = 'Paciente'
}) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [isMainLoading, setIsMainLoading] = useState<boolean>(true);
  const [mainImageError, setMainImageError] = useState<boolean>(false);
  const [loadedThumbnails, setLoadedThumbnails] = useState<Record<string, boolean>>({});
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'showcase' | 'grid'>('showcase');

  // Inicializar o sincronizar el elemento seleccionado
  useEffect(() => {
    if (images.length > 0) {
      // Si la imagen seleccionada actual ya no existe o está vacía, seleccionar la primera
      if (!selectedId || !images.some(img => img.id === selectedId)) {
        setSelectedId(images[0].id);
        setIsMainLoading(true);
        setMainImageError(false);
        setPreviewRotation(0);
      }
    } else {
      setSelectedId('');
      setIsMainLoading(false);
    }
  }, [images, selectedId]);

  const selectedImage = useMemo(() => {
    return images.find(img => img.id === selectedId) || images[0];
  }, [images, selectedId]);

  const selectedIndex = useMemo(() => {
    return images.findIndex(img => img.id === selectedId);
  }, [images, selectedId]);

  const handleSelectImage = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setIsMainLoading(true);
    setMainImageError(false);
    setPreviewRotation(0);
  };

  const handleNext = () => {
    if (images.length <= 1) return;
    const nextIdx = (selectedIndex + 1) % images.length;
    handleSelectImage(images[nextIdx].id);
  };

  const handlePrev = () => {
    if (images.length <= 1) return;
    const prevIdx = (selectedIndex - 1 + images.length) % images.length;
    handleSelectImage(images[prevIdx].id);
  };

  const handleDownloadSingle = (url: string, label: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clinica_SM_${(label || 'Foto').replace(/\s+/g, '_')}_${Date.now()}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isBackblazeUrl = (url?: string) => {
    if (!url) return false;
    return url.includes('backblazeb2.com') || url.includes('/file/clinica-san-miguel-fotos');
  };

  return (
    <div className="bg-[#111827] rounded-[28px] border border-slate-800 p-4 sm:p-6 shadow-2xl space-y-4">
      {/* HEADER DE LA GALERÍA CON ACCIONES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">photo_library</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase">
                Galería en Alta Resolución
              </h3>
              <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black text-[8px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px]">hd</span> HD 2048px
              </span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 mt-0.5">
              {images.length > 0 
                ? `${images.length} captura(s) clínica(s) guardadas en la nube` 
                : 'Sin imágenes clínicas archivadas todavía'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {images.length > 0 && (
            <div className="flex bg-slate-900 rounded-xl p-0.5 border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('showcase')}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                  viewMode === 'showcase' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Detallada HD con Visor"
              >
                <span className="material-symbols-outlined text-xs">aspect_ratio</span>
                <span className="hidden sm:inline">Visor HD</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Cuadrícula Mosaico"
              >
                <span className="material-symbols-outlined text-xs">grid_view</span>
                <span className="hidden sm:inline">Mosaico</span>
              </button>
            </div>
          )}

          <button 
            type="button"
            onClick={onUploadClick} 
            disabled={isOptimizing}
            className="flex-1 sm:flex-none h-9 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            {isOptimizing ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin">sync</span>
                PROCESANDO HD...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">add_a_photo</span>
                SUBIR FOTO HD
              </>
            )}
          </button>
        </div>
      </div>

      {/* CASO: NO HAY IMÁGENES */}
      {images.length === 0 && (
        <div className="py-12 sm:py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30 flex flex-col items-center justify-center px-4">
          <div className="size-16 rounded-3xl bg-slate-800/80 text-slate-500 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-3xl">image</span>
          </div>
          <p className="text-xs font-black text-slate-300 uppercase tracking-widest">
            Aún no hay imágenes clínicas
          </p>
          <p className="text-[10px] text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
            Puedes subir radiografías, fotografías intraorales o capturas del odontograma. Se optimizarán a 2048px en HD y se guardarán en Backblaze B2.
          </p>
          <button
            type="button"
            onClick={onUploadClick}
            disabled={isOptimizing}
            className="h-10 px-5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add_a_photo</span>
            Subir Primera Fotografía
          </button>
        </div>
      )}

      {/* MODO SHOWCASE: VISTA PREVIA DESTACADA EN ALTA DEFINICIÓN + CARRETE */}
      {images.length > 0 && viewMode === 'showcase' && selectedImage && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* LIENZO DE VISTA PREVIA HD CON ESQUELETO ELEGANTE */}
          <div className="relative w-full h-[320px] sm:h-[420px] lg:h-[460px] bg-slate-950/80 rounded-[24px] border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner group">
            
            {/* ESQUELETO DE CARGA ELEGANTE (SKELETON SHIMMER) */}
            {isMainLoading && (
              <div className="absolute inset-0 z-20 bg-slate-900 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
                {/* Animación Shimmer Wave de izquierda a derecha */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.8s_infinite]"></div>

                {/* Contenido del Esqueleto */}
                <div className="relative z-10 flex flex-col items-center max-w-xs text-center">
                  <div className="relative size-20 rounded-3xl bg-slate-800 border border-slate-700/60 flex items-center justify-center mb-4 shadow-xl">
                    <span className="material-symbols-outlined text-4xl text-blue-400 animate-pulse">dentistry</span>
                    <span className="absolute -top-1 -right-1 size-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-ping"></span>
                  </div>

                  {/* Barras de Esqueleto simuladas */}
                  <div className="h-3.5 w-44 bg-slate-800 rounded-full mb-2 animate-pulse"></div>
                  <div className="h-2.5 w-32 bg-slate-800/80 rounded-full mb-4 animate-pulse"></div>

                  <div className="flex items-center gap-2 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/40">
                    <span className="material-symbols-outlined text-sm text-emerald-400 animate-spin">sync</span>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      Recuperando HD desde Backblaze...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ERROR DE CARGA (FALLBACK) */}
            {mainImageError && (
              <div className="absolute inset-0 z-20 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                <span className="material-symbols-outlined text-4xl text-rose-500 mb-2">broken_image</span>
                <p className="text-xs font-black text-slate-300 uppercase tracking-wider">No se pudo cargar la imagen HD</p>
                <p className="text-[10px] text-slate-500 mt-1 mb-3">Comprueba tu conexión a la nube</p>
                <button
                  onClick={() => { setIsMainLoading(true); setMainImageError(false); }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-bold"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* IMAGEN PRINCIPAL EN ALTA RESOLUCIÓN */}
            <img
              src={selectedImage.url}
              alt={selectedImage.label || 'Imagen Clínica HD'}
              loading="lazy"
              decoding="async"
              onLoad={() => setIsMainLoading(false)}
              onError={() => { setIsMainLoading(false); setMainImageError(true); }}
              style={{
                transform: `rotate(${previewRotation}deg)`,
                imageRendering: 'auto'
              }}
              className={`max-w-full max-h-full object-contain rounded-xl transition-all duration-300 ${
                isMainLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
              }`}
            />

            {/* BADGES EN ESQUINA SUPERIOR IZQUIERDA */}
            <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-1.5 pointer-events-none">
              <span className="bg-slate-900/90 text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-xl border border-slate-700 backdrop-blur-md shadow-lg flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-blue-400">hd</span>
                CALIDAD HD
              </span>

              {isBackblazeUrl(selectedImage.url) ? (
                <span className="bg-emerald-950/90 text-emerald-300 text-[8px] font-black uppercase px-2.5 py-1 rounded-xl border border-emerald-500/40 backdrop-blur-md shadow-lg flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  BACKBLAZE B2
                </span>
              ) : (
                <span className="bg-slate-900/90 text-slate-300 text-[8px] font-black uppercase px-2.5 py-1 rounded-xl border border-slate-700 backdrop-blur-md shadow-lg flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-blue-400"></span>
                  SUPABASE CLOUD
                </span>
              )}
            </div>

            {/* BOTONES DE HERRAMIENTAS FLOTANTES (ESQUINA SUPERIOR DERECHA) */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/80 shadow-2xl">
              <button
                type="button"
                onClick={() => setPreviewRotation(prev => (prev + 90) % 360)}
                className="size-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                title="Rotar 90°"
              >
                <span className="material-symbols-outlined text-base">rotate_right</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSingle(selectedImage.url, selectedImage.label)}
                className="size-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                title="Descargar imagen HD original"
              >
                <span className="material-symbols-outlined text-base">download</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenZoomModal(selectedImage.url)}
                className="size-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all active:scale-95 shadow-md shadow-blue-600/30 cursor-pointer"
                title="Abrir Visor Pantalla Completa con Zoom 400%"
              >
                <span className="material-symbols-outlined text-base">zoom_in</span>
              </button>

              <button
                type="button"
                onClick={() => onRequestDelete(selectedImage.id)}
                className="size-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                title="Eliminar captura"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>

            {/* BOTONES DE NAVEGACIÓN ANTERIOR / SIGUIENTE (SOBRE LA IMAGEN) */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-30 size-10 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 text-white flex items-center justify-center transition-all active:scale-90 shadow-2xl backdrop-blur-sm cursor-pointer opacity-80 group-hover:opacity-100"
                  title="Imagen anterior"
                >
                  <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-30 size-10 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 text-white flex items-center justify-center transition-all active:scale-90 shadow-2xl backdrop-blur-sm cursor-pointer opacity-80 group-hover:opacity-100"
                  title="Imagen siguiente"
                >
                  <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
              </>
            )}

            {/* PIE DE FOTO / INFORMACIÓN DE LA IMAGEN SELECCIONADA */}
            <div className="absolute bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10px]">
              <div className="min-w-0 flex items-center gap-2">
                <span className="font-black text-white truncate text-xs">
                  {selectedImage.label || 'Captura Clínica'}
                </span>
                <span className="text-slate-400 font-bold shrink-0">
                  • {new Date(selectedImage.date).toLocaleDateString()}
                </span>
              </div>
              <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider shrink-0">
                Foto {selectedIndex + 1} de {images.length}
              </span>
            </div>
          </div>

          {/* CARRETE DE MINIATURAS (FILMSTRIP) CON CARGA INDIVIDUAL OPTIMIZADA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Índice de Capturas ({images.length})
              </span>
              <span className="text-[8px] text-slate-500 font-bold">
                Haz clic en una miniatura para verla en HD
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
              {images.map((img, idx) => {
                const isSelected = img.id === selectedId;
                const isThumbLoaded = loadedThumbnails[img.id];

                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => handleSelectImage(img.id)}
                    className={`group relative size-16 sm:size-20 rounded-2xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                      isSelected 
                        ? 'border-blue-500 ring-4 ring-blue-500/20 scale-105 shadow-xl' 
                        : 'border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-700'
                    }`}
                  >
                    {/* Skeleton individual de miniatura mientras carga */}
                    {!isThumbLoaded && (
                      <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center">
                        <span className="material-symbols-outlined text-xs text-slate-600">image</span>
                      </div>
                    )}

                    <img
                      src={img.url}
                      alt={img.label}
                      loading="lazy"
                      decoding="async"
                      onLoad={() => setLoadedThumbnails(prev => ({ ...prev, [img.id]: true }))}
                      className={`size-full object-cover transition-all duration-200 group-hover:scale-110 ${
                        isThumbLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                    />

                    {/* Insignia de orden */}
                    <span className="absolute top-1 left-1 bg-slate-900/80 text-white font-mono text-[7px] font-black px-1 rounded shadow">
                      #{idx + 1}
                    </span>

                    {/* Indicador de activo */}
                    {isSelected && (
                      <span className="absolute bottom-1 right-1 size-2 rounded-full bg-blue-500 ring-2 ring-slate-900"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODO GRID COMPLETO */}
      {images.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 animate-in fade-in duration-300">
          {images.map((img, idx) => {
            const isThumbLoaded = loadedThumbnails[img.id];

            return (
              <div
                key={img.id}
                className="group relative rounded-2xl overflow-hidden border border-slate-800 aspect-square bg-slate-900 shadow-sm"
              >
                {!isThumbLoaded && (
                  <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center">
                    <span className="material-symbols-outlined text-base text-slate-600">image</span>
                  </div>
                )}

                <img
                  src={img.url}
                  alt={img.label || 'Captura'}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => setLoadedThumbnails(prev => ({ ...prev, [img.id]: true }))}
                  className={`size-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                    isThumbLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ imageRendering: 'auto' }}
                />

                <span className="absolute top-1.5 left-1.5 bg-blue-600/90 text-white font-black text-[7px] px-1.5 py-0.5 rounded-md shadow flex items-center gap-0.5 pointer-events-none">
                  <span className="material-symbols-outlined text-[9px]">hd</span> HD
                </span>

                <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 p-1 transition-opacity">
                  <button
                    type="button"
                    onClick={() => { setSelectedId(img.id); setViewMode('showcase'); }}
                    className="size-7 bg-white text-slate-900 rounded-lg flex items-center justify-center shadow hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    title="Ver en Vista Previa HD"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenZoomModal(img.url)}
                    className="size-7 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    title="Zoom Pantalla Completa"
                  >
                    <span className="material-symbols-outlined text-sm">zoom_in</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDelete(img.id)}
                    className="size-7 bg-rose-600 text-white rounded-lg flex items-center justify-center shadow hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    title="Eliminar"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>

                {img.label && (
                  <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 px-1 py-0.5 truncate text-[7px] font-bold text-slate-300 pointer-events-none text-center">
                    {img.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HDGalleryPreview;
