import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, OnDestroy, signal, afterNextRender, computed, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { db, collection, addDoc, getDocs, query } from './firebase';

export interface Student {
  name: string;
  major?: string;
  track?: string;
  university?: 'Assiut University' | 'Assiut National University' | 'Other';
  city?: string;
  imageUrl?: string;
  freshmanImageUrl?: string;
  caption?: string;
}

export interface Memory {
  name: string;
  message: string;
  signatureFont?: string;
  imageUrl?: string;
}

export interface TimeCapsule {
  name: string;
  message: string;
  color?: string;
  date?: string;
}

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  speed: number;
  drift: number;
  phase: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [ReactiveFormsModule],
})
export class App implements OnDestroy {
  @ViewChild('starfield') starfield!: ElementRef<HTMLCanvasElement>;
  
  currentView = signal<'home' | 'classmates' | 'memories' | 'timecapsule'>('home');
  selectedUniversityTab = signal<'Assiut University' | 'Assiut National University'>('Assiut University');
  selectedCityTab = signal<string | null>(null);

  days = signal('000');
  hours = signal('00');
  mins = signal('00');
  secs = signal('00');
  
  memories = signal<Memory[]>([]);

  timeCapsules = signal<TimeCapsule[]>([]);

  students = signal<Student[]>([]);

  flippedClassmates = signal<Record<string, boolean>>({});

  assiutUniversityStudentsByCity = computed(() => {
    const uniStudents = this.students().filter(s => s.university === 'Assiut University');
    const cityMap = new Map<string, Student[]>();
    for (const s of uniStudents) {
      const city = s.city || 'Unknown';
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city)!.push(s);
    }
    return Array.from(cityMap.entries()).map(([city, students]) => ({ city, students })).sort((a, b) => a.city.localeCompare(b.city));
  });

  nationalUniversityStudentsByCity = computed(() => {
    const uniStudents = this.students().filter(s => s.university === 'Assiut National University');
    const cityMap = new Map<string, Student[]>();
    for (const s of uniStudents) {
      const city = s.city || 'Unknown';
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city)!.push(s);
    }
    return Array.from(cityMap.entries()).map(([city, students]) => ({ city, students })).sort((a, b) => a.city.localeCompare(b.city));
  });

  searchQuery = signal('');

  availableCitiesForUniversity = computed(() => {
    const data = this.selectedUniversityTab() === 'Assiut University' 
      ? this.assiutUniversityStudentsByCity() 
      : this.nationalUniversityStudentsByCity();
    return data.map(d => d.city);
  });

  currentStudents = computed(() => {
    const data = this.selectedUniversityTab() === 'Assiut University' 
      ? this.assiutUniversityStudentsByCity() 
      : this.nationalUniversityStudentsByCity();
    const city = this.selectedCityTab() || (data.length > 0 ? data[0].city : null);
    if (!city) return [];
    
    let filteredStudents = data.find(d => d.city === city)?.students || [];
    
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      filteredStudents = filteredStudents.filter(s => s.name.toLowerCase().includes(query) || s.major?.toLowerCase().includes(query));
    }
    
    return filteredStudents;
  });

  cities = [
    'Cairo', 'Alexandria', 'Giza', 'Qalyubia', 'Dakahlia', 'Sharqia',
    'Gharbia', 'Monufia', 'Beheira', 'Faiyum', 'Minya', 'Beni Suef',
    'Sohag', 'Qena', 'Asyut', 'Luxor', 'Aswan', 'Red Sea', 'New Valley',
    'Matrouh', 'North Sinai', 'South Sinai', 'Ismailia', 'Suez',
    'Port Said', 'Damietta', 'Kafr El Sheikh'
  ].sort();

  colors = ['#C9943A','#5B7FBE','#6BAA7A','#B86E8A','#5EC1C9'];

  signatureFonts = [
    { name: 'Classic', value: 'Dancing Script' },
    { name: 'Playful', value: 'Caveat' },
    { name: 'Elegant', value: 'Great Vibes' },
    { name: 'Retro', value: 'Pacifico' }
  ];

  governorateCoords: Record<string, {x: number, y: number}> = {
    'Alexandria': { x: 49, y: 3 },
    'Matrouh': { x: 22, y: 2 },
    'Beheira': { x: 54, y: 5 },
    'Kafr El Sheikh': { x: 59, y: 4 },
    'Dakahlia': { x: 63, y: 5 },
    'Damietta': { x: 68, y: 1 },
    'Port Said': { x: 73, y: 3 },
    'North Sinai': { x: 88, y: 4 },
    'Sharqia': { x: 65, y: 10 },
    'Monufia': { x: 59, y: 10 },
    'Qalyubia': { x: 61, y: 11 },
    'Cairo': { x: 62, y: 15 },
    'Giza': { x: 62, y: 16 },
    'Ismailia': { x: 72, y: 10 },
    'Suez': { x: 75, y: 16 },
    'South Sinai': { x: 86, y: 34 },
    'Faiyum': { x: 58, y: 23 },
    'Beni Suef': { x: 61, y: 26 },
    'Minya': { x: 57, y: 35 },
    'Asyut': { x: 61, y: 46 },
    'Sohag': { x: 67, y: 52 },
    'Qena': { x: 77, y: 56 },
    'Luxor': { x: 76, y: 62 },
    'Aswan': { x: 79, y: 78 },
    'Red Sea': { x: 88, y: 45 },
    'New Valley': { x: 55, y: 64 }
  };

  governorateData = computed(() => {
    const students = this.students();
    return this.cities.map(city => {
      const count = students.filter(s => s.city === city).length;
      const coords = this.governorateCoords[city] || { x: 50, y: 50 };
      return { city, count, ...coords };
    });
  });

  getTopGovernorates = computed(() => {
    return this.governorateData().filter(g => g.count > 0).sort((a, b) => b.count - a.count).slice(0, 4);
  });

  isModalOpen = signal(false);
  isMemoryModalOpen = signal(false);
  isCapsuleModalOpen = signal(false);
  isMobileMenuOpen = signal(false);
  isLightMode = signal(true);
  studentForm: FormGroup;
  memoryForm: FormGroup;
  capsuleForm: FormGroup;
  uploadedImage = signal<string | null>(null);
  uploadedFreshmanImage = signal<string | null>(null);
  uploadedMemoryImage = signal<string | null>(null);

  private fb = inject(FormBuilder);

  private animationFrameId?: number;
  private timerId?: ReturnType<typeof setInterval> | number;
  private resizeListener?: () => void;
  
  capsuleDays = signal('000');
  capsuleHours = signal('00');
  capsuleMins = signal('00');
  capsuleSecs = signal('00');
  private capsuleTimerId?: ReturnType<typeof setInterval> | number;

  constructor() {
    this.studentForm = this.fb.group({
      name: ['', Validators.required],
      major: ['', Validators.required],
      university: ['', Validators.required],
      city: ['', Validators.required],
      caption: [''],
    });

    this.memoryForm = this.fb.group({
      name: ['', Validators.required],
      message: ['', Validators.required],
      signatureFont: ['Dancing Script']
    });
    
    this.capsuleForm = this.fb.group({
      name: ['', Validators.required],
      message: ['', Validators.required],
    });

    afterNextRender(() => {
      this.initStarfield();
      this.initCountdown();
      this.initCapsuleCountdown();
      this.setLightTheme(true);
      this.loadLocalData();
    });
  }

  checkSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.setLightTheme(false);
    } else {
      this.setLightTheme(true);
    }
  }

  toggleTheme() {
    this.setLightTheme(!this.isLightMode());
  }

  toggleFlip(name: string) {
    this.flippedClassmates.update(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  }

  setLightTheme(isLight: boolean) {
    this.isLightMode.set(isLight);
    if (isLight) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    // Re-initialize starfield to adapt colors
    this.initStarfield();
  }

  openModal() {
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.studentForm.reset({
      name: '',
      major: '',
      university: '',
      city: '',
      caption: ''
    });
    this.uploadedImage.set(null);
    this.uploadedFreshmanImage.set(null);
  }

  openMemoryModal() {
    this.isMemoryModalOpen.set(true);
  }

  closeMemoryModal() {
    this.isMemoryModalOpen.set(false);
    this.memoryForm.reset({
      name: '',
      message: '',
      signatureFont: 'Dancing Script'
    });
    this.uploadedMemoryImage.set(null);
  }

  openCapsuleModal() {
    this.isCapsuleModalOpen.set(true);
  }

  closeCapsuleModal() {
    this.isCapsuleModalOpen.set(false);
    this.capsuleForm.reset({
      name: '',
      message: ''
    });
  }

  onImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.uploadedImage.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onFreshmanImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.uploadedFreshmanImage.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onMemoryImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.uploadedMemoryImage.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  submitForm() {
    if (this.studentForm.valid) {
      const newStudent: Student = {
        name: this.studentForm.value.name,
        major: this.studentForm.value.major,
        university: this.studentForm.value.university,
        city: this.studentForm.value.city,
        imageUrl: this.uploadedImage() || undefined,
        freshmanImageUrl: this.uploadedFreshmanImage() || undefined,
        track: 'New Graduate',
        caption: this.studentForm.value.caption || undefined
      };
      this.students.update(s => {
        const updated = [newStudent, ...s];
        try {
          localStorage.setItem('fci_students', JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving classmate to localStorage:', e);
        }
        return updated;
      });

      // Save to Firebase asynchronously
      addDoc(collection(db, 'students'), newStudent).catch(err => {
        console.error('Error saving classmate to Firebase:', err);
      });

      this.closeModal();
    }
  }

  submitMemoryForm() {
    if (this.memoryForm.valid) {
      const newMemory = {
        name: this.memoryForm.value.name,
        message: this.memoryForm.value.message,
        imageUrl: this.uploadedMemoryImage() || undefined,
        signatureFont: this.memoryForm.value.signatureFont
      };
      this.memories.update(m => {
        const updated = [newMemory, ...m];
        try {
          localStorage.setItem('fci_memories', JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving memory to localStorage:', e);
        }
        return updated;
      });

      // Save to Firebase asynchronously
      addDoc(collection(db, 'memories'), newMemory).catch(err => {
        console.error('Error saving memory to Firebase:', err);
      });

      this.closeMemoryModal();
    }
  }

  submitCapsuleForm() {
    if (this.capsuleForm.valid) {
      const newCapsule = {
        name: this.capsuleForm.value.name,
        message: this.capsuleForm.value.message,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        date: new Date().toISOString()
      };
      this.timeCapsules.update(m => {
        const updated = [newCapsule, ...m];
        try {
          localStorage.setItem('fci_capsules', JSON.stringify(updated));
        } catch (e) {
          console.error('Error saving time capsule to localStorage:', e);
        }
        return updated;
      });

      // Save to Firebase asynchronously
      addDoc(collection(db, 'time_capsules'), newCapsule).catch(err => {
        console.error('Error saving time capsule to Firebase:', err);
      });

      this.closeCapsuleModal();
    }
  }

  async loadLocalData() {
    // 1. Students
    try {
      const q = query(collection(db, 'students'));
      const querySnapshot = await getDocs(q);
      const loadedStudents: Student[] = [];
      querySnapshot.forEach((doc) => {
        loadedStudents.push(doc.data() as Student);
      });
      this.students.set(loadedStudents);
      try {
        localStorage.setItem('fci_students', JSON.stringify(loadedStudents));
      } catch {
        console.warn('Could not save students to local storage');
      }
    } catch (e) {
      console.warn('Firebase students failed, falling back to local storage', e);
      const stored = localStorage.getItem('fci_students');
      if (stored) {
        try {
          this.students.set(JSON.parse(stored));
        } catch {
          console.error('Failed to parse cached students');
        }
      }
    }

    // 2. Memories
    try {
      const q = query(collection(db, 'memories'));
      const querySnapshot = await getDocs(q);
      const loadedMemories: Memory[] = [];
      querySnapshot.forEach((doc) => {
        loadedMemories.push(doc.data() as Memory);
      });
      this.memories.set(loadedMemories);
      try {
        localStorage.setItem('fci_memories', JSON.stringify(loadedMemories));
      } catch {
        console.warn('Could not save memories to local storage');
      }
    } catch (e) {
      console.warn('Firebase memories failed, falling back to local storage', e);
      const stored = localStorage.getItem('fci_memories');
      if (stored) {
        try {
          this.memories.set(JSON.parse(stored));
        } catch {
          console.error('Failed to parse cached memories');
        }
      }
    }

    // 3. Time Capsules
    try {
      const q = query(collection(db, 'time_capsules'));
      const querySnapshot = await getDocs(q);
      const loadedCapsules: TimeCapsule[] = [];
      querySnapshot.forEach((doc) => {
        loadedCapsules.push(doc.data() as TimeCapsule);
      });
      this.timeCapsules.set(loadedCapsules);
      try {
        localStorage.setItem('fci_capsules', JSON.stringify(loadedCapsules));
      } catch {
        console.warn('Could not save capsules to local storage');
      }
    } catch (e) {
      console.warn('Firebase capsules failed, falling back to local storage', e);
      const stored = localStorage.getItem('fci_capsules');
      if (stored) {
        try {
          this.timeCapsules.set(JSON.parse(stored));
        } catch {
          console.error('Failed to parse cached capsules');
        }
      }
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2);
  }

  ngOnDestroy() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.timerId) clearInterval(this.timerId);
    if (this.capsuleTimerId) clearInterval(this.capsuleTimerId);
    if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
  }

  private initStarfield() {
    if (!this.starfield) return;
    const canvas = this.starfield.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }

    let stars: Star[] = [];
    const COUNT = 220;

    const buildStars = () => {
      stars = Array.from({ length: COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.2,
        alpha: Math.random() * 0.6 + 0.1,
        speed: Math.random() * 0.25 + 0.05,
        drift: (Math.random() - 0.5) * 0.08,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      buildStars();
    };

    this.resizeListener = resize;
    window.addEventListener('resize', resize);
    resize();

    const draw = (ts: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = ts / 1000;
      const isLight = this.isLightMode();
      
      stars.forEach(s => {
        const flicker = s.alpha + Math.sin(t * 1.2 + s.phase) * 0.12;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? `rgba(17,24,39,${Math.max(0, flicker * 0.5)})` : `rgba(240,237,223,${Math.max(0, flicker)})`;
        ctx.fill();

        s.y -= s.speed;
        s.x += s.drift;
        if (s.y < -4) { s.y = canvas.height + 4; s.x = Math.random() * canvas.width; }
      });
      this.animationFrameId = requestAnimationFrame(draw);
    };

    this.animationFrameId = requestAnimationFrame(draw);
  }

  private initCountdown() {
    const gala = new Date('2027-06-23T20:00:00').getTime();
    const pads = (n: number, l=2) => String(n).padStart(l, '0');
    
    const tick = () => {
      const diff = gala - Date.now();
      if (diff <= 0) {
        this.days.set('000');
        this.hours.set('00');
        this.mins.set('00');
        this.secs.set('00');
        return;
      }
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000) / 60000);
      const secs  = Math.floor((diff % 60000) / 1000);
      this.days.set(pads(days, 3));
      this.hours.set(pads(hours));
      this.mins.set(pads(mins));
      this.secs.set(pads(secs));
    };
    
    tick(); 
    this.timerId = setInterval(tick, 1000);
  }

  private initCapsuleCountdown() {
    const target = new Date('2032-06-01T00:00:00').getTime();
    const pads = (n: number, l=2) => String(n).padStart(l, '0');
    
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        this.capsuleDays.set('000');
        this.capsuleHours.set('00');
        this.capsuleMins.set('00');
        this.capsuleSecs.set('00');
        return;
      }
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000) / 60000);
      const secs  = Math.floor((diff % 60000) / 1000);
      this.capsuleDays.set(pads(days, 3));
      this.capsuleHours.set(pads(hours));
      this.capsuleMins.set(pads(mins));
      this.capsuleSecs.set(pads(secs));
    };
    
    tick(); 
    this.capsuleTimerId = setInterval(tick, 1000);
  }
}
