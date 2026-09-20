"use client";
import { ArrowLeft, ArrowRight, Check, Drama, Leaf, Lightbulb, ShieldCheck, Sparkles, Trees, UserRoundX, Users, Waypoints, Mail, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, type ReactNode } from "react";
import { PROPOSAL_CATEGORIES, PROPOSAL_CATEGORY_LABELS } from "@/modules/proposals/domain";
import { Button, Input, Textarea, cn } from "@/shared/ui";
import { createProposalAction, type ProposalActionState } from "./actions";

const initialState: ProposalActionState = { status: "idle", fieldErrors: {} };
type Values = { title: string; category: string; content: string; submissionMode: string; contactEmail: string };
const initialValues: Values = { title: "", category: "", content: "", submissionMode: "", contactEmail: "" };

const PROPOSAL_CATEGORY_ICONS: Record<(typeof PROPOSAL_CATEGORIES)[number], LucideIcon> = {
  environment: Leaf,
  mobility: Waypoints,
  public_spaces: Trees,
  culture: Drama,
  social: Users,
  development: Sparkles,
  other: Lightbulb
};


export function ProposalWizard() {
  const router = useRouter(); const [step, setStep] = useState(0); const [help, setHelp] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [values, setValues] = useState(initialValues); const [state, action, pending] = useActionState(createProposalAction, initialState);
  const visibleStep = state.status === "success" ? 4 : step;
  const dirty = Object.values(values).some(Boolean);
  function exit() { if (!dirty || window.confirm("Vuoi uscire? I dati inseriti andranno persi.")) router.push("/"); }
  function patch(key: keyof Values, value: string) { setValues((current) => ({ ...current, [key]: value })); }
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-40 bg-background/95 px-6 backdrop-blur sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center gap-4 py-3">
        <button className="inline-flex items-center gap-2 justify-self-start text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={exit} type="button"><ArrowLeft className="size-4" />Esci</button>
        <span aria-label="Visione Comune" className="admin-brand-logo size-14 justify-self-center" role="img" />
        <Button aria-label="Guida" className="size-10 justify-self-end rounded-full px-0" onClick={() => setHelp(true)} variant="secondary">?</Button>
      </div>
      {visibleStep < 4 ? <div className="absolute inset-x-0 bottom-0 h-[3px] bg-border"><div className={cn("h-full bg-primary transition-all", visibleStep === 0 ? "w-0" : visibleStep === 1 ? "w-1/3" : visibleStep === 2 ? "w-2/3" : "w-full")} /></div> : null}
    </header>
    <main className="grid min-h-[calc(100vh-5.5rem)] px-6 py-10 sm:px-8 lg:px-12"><section className="mx-auto grid w-full max-w-3xl content-center gap-8">
      {visibleStep === 0 ? <Intro onNext={() => setStep(1)} /> : null}
      {visibleStep === 1 ? <ProposalStep values={values} errors={state.fieldErrors} patch={patch} onBack={() => setStep(0)} onNext={() => setStep(2)} /> : null}
      {visibleStep === 2 ? <ContactStep values={values} errors={state.fieldErrors} patch={patch} onBack={() => setStep(1)} onNext={() => setStep(3)} /> : null}
      {visibleStep === 3 ? <form action={action}><input type="hidden" name="title" value={values.title}/><input type="hidden" name="category" value={values.category}/><input type="hidden" name="content" value={values.content}/><input type="hidden" name="submissionMode" value={values.submissionMode}/><input type="hidden" name="contactEmail" value={values.contactEmail}/><input type="hidden" name="privacyAcknowledged" value={privacyAcknowledged ? "accepted" : ""}/><Review values={values} message={state.message} pending={pending} privacyAcknowledged={privacyAcknowledged} privacyError={state.fieldErrors.privacyAcknowledged} onPrivacyChange={setPrivacyAcknowledged} onBack={() => setStep(2)} onEdit={setStep}/></form> : null}
      {visibleStep === 4 ? <Success onExit={() => router.push("/")} /> : null}
    </section></main>
    {help ? <Help onClose={() => setHelp(false)} /> : null}
  </div>;
}

function Heading({ title, subtitle }: { title: string; subtitle?: string }) { return <header className="grid gap-2"><h1 className="font-serif text-4xl font-semibold sm:text-5xl">{title}</h1>{subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}</header>; }
function Intro({ onNext }: { onNext: () => void }) {
  const items = ["Racconta l’idea", "Scegli se lasciare un contatto", "Invia la proposta"];

  return <div className="grid gap-8">
    <Heading title="Proponi un’idea" subtitle="Condividi con Visione Comune un’idea per il territorio."/>
    <ol className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
      {items.map((item, index) => <li className="grid justify-items-start gap-2 rounded-xl bg-muted/40 px-4 py-5 text-left" key={item}>
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
        <span className="text-sm font-semibold text-foreground">{item}</span>
      </li>)}
    </ol>
    <div className="grid justify-items-start gap-3"><Button onClick={onNext}>Inizia<ArrowRight className="size-4"/></Button><p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4"/>Puoi inviarla anche in forma anonima.</p></div>
  </div>;
}
type StepProps = { values: Values; errors: Record<string,string>; patch: (key:keyof Values,value:string)=>void; onBack:()=>void; onNext:()=>void };
function ProposalStep({ values, errors, patch, onBack, onNext }: StepProps) { const valid=values.title.trim()&&values.category&&values.content.trim(); return <div className="grid gap-8"><Heading title="Raccontaci la tua idea"/><div className="grid gap-6"><Field label="Titolo della proposta" error={errors.title}><Input maxLength={180} placeholder="Es. Creare uno spazio per attività di quartiere" value={values.title} onChange={(e)=>patch("title",e.target.value)}/></Field><Field label="Ambito" error={errors.category}><div className="flex flex-wrap gap-2">{PROPOSAL_CATEGORIES.map((category) => {
              const selected = values.category === category;
              const CategoryIcon = PROPOSAL_CATEGORY_ICONS[category];
              return <button
                aria-pressed={selected}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                key={category}
                onClick={() => patch("category", category)}
                type="button"
              >
                <CategoryIcon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
                {PROPOSAL_CATEGORY_LABELS[category]}
              </button>;
            })}</div></Field><Field label="Descrivi la tua proposta" error={errors.content}><Textarea maxLength={5000} placeholder="Descrivi la tua idea, a chi potrebbe essere utile e come potrebbe migliorare il territorio." rows={8} value={values.content} onChange={(e)=>patch("content",e.target.value)}/></Field></div><Nav onBack={onBack} onNext={onNext} disabled={!valid}/></div>; }
function ContactStep({ values, errors, patch, onBack, onNext }: StepProps) { const valid=values.submissionMode==="anonymous"||(values.submissionMode==="contact"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)); return <div className="grid gap-8"><Heading title="Vuoi essere ricontattato?" subtitle="Puoi inviare la proposta in forma anonima oppure lasciare un contatto."/><div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><Choice active={values.submissionMode==="anonymous"} description="Non salveremo alcun dato personale." icon={UserRoundX} onClick={()=>{patch("submissionMode","anonymous");patch("contactEmail","");}}>Invia in forma anonima</Choice><Choice active={values.submissionMode==="contact"} description="Lascia un’email per un eventuale ricontatto." icon={Mail} onClick={()=>patch("submissionMode","contact")}>Lascia un contatto</Choice></div>{values.submissionMode==="contact"?<Field label="Email" error={errors.contactEmail} help="La useremo solo per ricontattarti riguardo questa proposta."><Input type="email" maxLength={320} value={values.contactEmail} onChange={(e)=>patch("contactEmail",e.target.value)}/></Field>:null}</div><Nav onBack={onBack} onNext={onNext} disabled={!valid}/></div>; }
function Choice({active,description,icon:Icon,onClick,children}:{active:boolean;description:string;icon:LucideIcon;onClick:()=>void;children:ReactNode}){
  return <button type="button" aria-pressed={active} onClick={onClick} className={cn("grid min-h-36 content-start gap-3 rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",active?"border-primary bg-primary/10":"border-border bg-background hover:bg-muted")}>
    <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
      <Icon aria-hidden="true" className="size-5" strokeWidth={2}/>
    </span>
    <span className="grid gap-1">
      <span className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>{children}</span>
      <span className="text-sm leading-5 text-muted-foreground">{description}</span>
    </span>
  </button>
}
function Review({values,message,pending,privacyAcknowledged,privacyError,onPrivacyChange,onBack,onEdit}:{values:Values;message?:string;pending:boolean;privacyAcknowledged:boolean;privacyError?:string;onPrivacyChange:(checked:boolean)=>void;onBack:()=>void;onEdit:(step:number)=>void}){return <div className="grid gap-8"><Heading title="Controlla la proposta"/>{message?<p role="alert" className="text-sm text-destructive">{message}</p>:null}<div className="grid gap-7"><ReviewSection onEdit={()=>onEdit(1)}><ReviewValue label="Titolo"><p>{values.title}</p></ReviewValue><ReviewCategory category={values.category as keyof typeof PROPOSAL_CATEGORY_LABELS}/><ReviewValue label="Descrizione"><p className="whitespace-pre-wrap leading-7">{values.content}</p></ReviewValue></ReviewSection><ReviewSection title="Contatto" onEdit={()=>onEdit(2)}><p>{values.submissionMode==="anonymous"?"Anonimo":values.contactEmail}</p></ReviewSection></div><div className="grid gap-2"><label className="flex items-start gap-3 text-sm leading-6"><input checked={privacyAcknowledged} className="mt-1 size-4 accent-primary" name="privacyConfirmation" onChange={(event)=>onPrivacyChange(event.currentTarget.checked)} type="checkbox"/><span>Dichiaro di aver preso visione dell’<Link className="font-medium text-primary underline underline-offset-4" href="/privacy">Informativa privacy</Link>.</span></label>{privacyError?<p className="text-sm text-destructive" role="alert">{privacyError}</p>:null}</div><div className="flex justify-between gap-3"><Button type="button" variant="secondary" onClick={onBack}>Indietro</Button><Button disabled={pending||!privacyAcknowledged} type="submit">Invia proposta<Check className="size-4"/></Button></div></div>}
function ReviewSection({title,onEdit,children}:{title?:string;onEdit:()=>void;children:ReactNode}){return <section className="grid gap-3 border-b border-border pb-7"><div className={cn("flex items-center", title ? "justify-between" : "justify-end")}>{title ? <p className="text-sm text-muted-foreground">{title}</p> : null}<button className="text-sm font-semibold text-primary hover:underline" type="button" onClick={onEdit}>Modifica</button></div>{children}</section>}
function ReviewValue({label,children}:{label:string;children:ReactNode}){return <div className="grid gap-1"><p className="text-sm text-muted-foreground">{label}</p>{children}</div>}
function ReviewCategory({category}:{category:keyof typeof PROPOSAL_CATEGORY_LABELS}){const Icon=PROPOSAL_CATEGORY_ICONS[category];return <ReviewValue label="Ambito"><p className="flex items-center gap-2"><Icon aria-hidden="true" className="size-4 text-foreground" strokeWidth={2}/><span>{PROPOSAL_CATEGORY_LABELS[category]}</span></p></ReviewValue>}
function Success({onExit}:{onExit:()=>void}){return <div className="grid justify-items-start gap-6"><span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary"><Check/></span><Heading title="Proposta ricevuta" subtitle="Grazie. La proposta è stata inviata a Visione Comune."/><Button onClick={onExit}>Torna al sito</Button></div>}
function Field({label,error,help,children}:{label:string;error?:string;help?:string;children:ReactNode}){return <label className="grid gap-2"><span className="text-sm text-muted-foreground">{label}</span>{children}{help?<span className="text-sm text-muted-foreground">{help}</span>:null}{error?<span className="text-sm text-destructive">{error}</span>:null}</label>}
function Nav({onBack,onNext,disabled}:{onBack:()=>void;onNext:()=>void;disabled:boolean}){return <div className="flex justify-between gap-3"><Button type="button" variant="secondary" onClick={onBack}>Indietro</Button><Button type="button" disabled={disabled} onClick={onNext}>Continua<ArrowRight className="size-4"/></Button></div>}
function Help({onClose}:{onClose:()=>void}){return <div className="fixed inset-0 z-50"><button aria-label="Chiudi guida" className="absolute inset-0 h-full w-full bg-foreground/20" onClick={onClose}/><aside role="dialog" aria-modal="true" className="absolute right-0 top-0 grid h-full w-full max-w-md content-start gap-6 border-l border-border bg-background p-8"><div className="flex justify-between gap-4"><h2 className="font-serif text-2xl font-semibold">Come proporre un’idea</h2><Button variant="ghost" onClick={onClose}>Chiudi</Button></div><p className="text-sm leading-6 text-muted-foreground">Descrivi l’idea e scegli se inviarla in forma anonima o lasciare un’email. La proposta resterà privata e sarà letta da Visione Comune.</p></aside></div>}
