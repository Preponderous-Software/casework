// Entry point for spike/exam-room.html: the exam view on its own, for trying the 3D room.
import { createExamView } from "./exam-room.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
createExamView({
  canvas: $<HTMLCanvasElement>("view"),
  last: $("last"),
  turn: $<HTMLButtonElement>("turn"),
  regions: $("regions"),
  fallback: $("fallback"),
  status: $("status"),
});
