import { Component, OnInit, HostListener } from '@angular/core';
import Vex from "vexflow";
import { Observable } from 'rxjs';
import { MidiService } from '../midi.service';
import { DisplayNote } from '../../display-note'

const SPEED_FACTOR: number = .1;

@Component({
  selector: 'note-panel',
  templateUrl: './note-panel.component.html',
  styleUrls: ['./note-panel.component.sass']
})
export class NotePanelComponent implements OnInit {
  notes: DisplayNote[] = [];
  start: DOMHighResTimeStamp;
  prev: DOMHighResTimeStamp;
  lastNoteTime: DOMHighResTimeStamp = performance.now();
  nps: number = 1;
  boundUpdate: () => void;
  speed: number = 1;
  context: Vex.IRenderContext;
  tickContext: Vex.Flow.TickContext;
  stave: Vex.Flow.Stave;
  progress: number = 0;
  fail: number = 0;
  success: number = 0;
  currentNoteIndex: number = 0;

  constructor(private midi: MidiService) {
    this.boundUpdate = this.update.bind(this);
  }

  ngOnInit(): void {
    const VF = Vex.Flow;
    const div = document.getElementById('vex-target')
    const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
    renderer.resize(1400, 500);
    this.context = renderer.getContext()
    this.context.scale(3, 3);
    const width = 1212;
    this.stave = new VF.Stave(10, 10, width/3).addClef('treble');
    this.stave.setContext(this.context).draw();
    this.tickContext = new VF.TickContext();

    window.requestAnimationFrame(this.boundUpdate);
    this.midi.noteEmitter.subscribe((note: number) => {
      const currentNote = this.notes[this.currentNoteIndex];
      if (currentNote && note === currentNote.noteValue) {
        currentNote.succeed();
        this.success++;
        this.currentNoteIndex++;
      } else if (currentNote) {
        currentNote.fail();
        this.fail++;
      }
    });
  }

  @HostListener('document:keypress', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === "d") {
      this.notes[this.currentNoteIndex].fail();
      this.fail++;
    } else {
      this.notes[this.currentNoteIndex].succeed();
      this.success++;
      this.currentNoteIndex++;
    }
  }

  getRandomNote(): Vex.Flow.StaveNote {
    const durations = ['8', '4', '2', '1'];
    let letter = String.fromCharCode('a'.charCodeAt(0) + Math.floor(Math.random() * 7))
    let octave = `${4 + Math.floor(Math.random() * 1)}`
    let acc = '';
    const note = new Vex.Flow.StaveNote({
      clef: 'treble',
      keys: [`${letter}${acc}/${octave}`],
      duration: '4',
    })

    if (acc) note.addAccidental(0, new Vex.Flow.Accidental(acc));

    return note;
  }

  drawNote(tc: Vex.Flow.TickContext, s: Vex.Flow.Stave, c: Vex.IRenderContext): void {
    const group = c.openGroup(); // create an SVG group element
    const note = this.getRandomNote();
    const dn = new DisplayNote(note);
    this.notes.push(dn);

    tc.addTickable(note);
    note.setContext(c).setStave(s)

    note.draw();

    // add initial transform
    const t = document.getElementsByTagName("svg")[0].createSVGTransform();
    dn.el().transform.baseVal.appendItem(t);

    dn.setX(this.stave.getWidth() - 50);

    c.closeGroup();
    const box = (group as any).getBoundingClientRect();
  }

  update(timestamp) {
    if (this.start === undefined) {
      this.start = timestamp;
      this.prev = timestamp;
    }
    const elapsed = timestamp - this.prev;
    if (1000 / this.nps < timestamp - this.lastNoteTime && this.progress < 100) {
      this.drawNote(this.tickContext, this.stave, this.context);
      this.lastNoteTime = timestamp;
      this.progress++;
    }

    this.notes.forEach((n) => {
      n.setX(n.x - elapsed * this.speed * SPEED_FACTOR);
      if (n.x <= 0 && !n.removed) {
        n.removed = true;
        if (!n.failed && !n.succeeded) {
          n.fail();
          this.fail++;
          setTimeout(() => n.remove(), 100);
        }
        this.currentNoteIndex++;
      }
      n.updatePosition();
    });



    this.prev = timestamp;
    window.requestAnimationFrame(this.boundUpdate);
  }
}
