import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, OnDestroy, signal, afterNextRender, computed, inject, effect, untracked } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { db, collection, addDoc, getDocs, query, where } from './firebase';

export interface Student {
  name: string;
  major?: string;
  track?: string;
  university?: 'Assiut University' | 'Assiut National University' | 'Other';
  city?: string;
  imageUrl?: string;
  freshmanImageUrl?: string;
  caption?: string;
  updatedAt?: string;
  status?: 'active' | 'deleted';
}

export interface Memory {
  name: string;
  message: string;
  signatureFont?: string;
  imageUrl?: string;
  updatedAt?: string;
  status?: 'active' | 'deleted';
}

export interface TimeCapsule {
  name: string;
  message: string;
  color?: string;
  date?: string;
  updatedAt?: string;
  status?: 'active' | 'deleted';
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

  visibleClassmatesCount = signal(10);
  classmatesSortOrder = signal<'alphabetical' | 'newest' | 'oldest'>('alphabetical');
  visibleMemoriesCount = signal(10);
  memoriesSortOrder = signal<'newest' | 'oldest'>('newest');

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

  filteredClassmates = computed(() => {
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
    
    const sorted = [...filteredStudents];
    const order = this.classmatesSortOrder();
    if (order === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'newest') {
      sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } else if (order === 'oldest') {
      sorted.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
    }
    
    return sorted;
  });

  currentStudents = computed(() => {
    return this.filteredClassmates().slice(0, this.visibleClassmatesCount());
  });

  hasMoreClassmates = computed(() => {
    return this.filteredClassmates().length > this.visibleClassmatesCount();
  });

  filteredMemories = computed(() => {
    const sorted = [...this.memories()];
    const order = this.memoriesSortOrder();
    if (order === 'newest') {
      sorted.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } else if (order === 'oldest') {
      sorted.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
    }
    return sorted;
  });

  currentMemories = computed(() => {
    return this.filteredMemories().slice(0, this.visibleMemoriesCount());
  });

  hasMoreMemories = computed(() => {
    return this.filteredMemories().length > this.visibleMemoriesCount();
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
  isSubmitting = signal(false);
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
    });

    effect(() => {
      this.selectedUniversityTab();
      this.selectedCityTab();
      this.searchQuery();
      untracked(() => this.visibleClassmatesCount.set(10));
    });

    effect(() => {
      this.memoriesSortOrder();
      untracked(() => this.visibleMemoriesCount.set(10));
    });
  }

  setView(view: 'home' | 'classmates' | 'memories' | 'timecapsule') {
    this.currentView.set(view);
    this.isMobileMenuOpen.set(false);
    
    if (view === 'classmates' && this.students().length === 0) {
      this.loadStudents();
    } else if (view === 'memories' && this.memories().length === 0) {
      this.loadMemories();
    } else if (view === 'timecapsule' && this.timeCapsules().length === 0) {
      this.loadTimeCapsules();
    }
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

  private compressImage(dataUrl: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = (err) => {
        reject(err);
      };
    });
  }

  private async uploadToCloudinary(base64DataUrl: string): Promise<string> {
    const cloudName = 'ddncvahi8';
    const uploadPreset = 'ml_default';
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    const formData = new FormData();
    formData.append('file', base64DataUrl);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Failed to upload image to Cloudinary');
    }

    const data = await response.json();
    return data.secure_url;
  }

  getOptimizedImageUrl(url?: string, width = 300): string {
    if (!url) return '';
    if (url.includes('cloudinary.com')) {
      return url.replace('/upload/', `/upload/w_${width},c_limit,q_auto,f_auto/`);
    }
    return url;
  }

  onImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const compressed = await this.compressImage(reader.result as string);
          this.uploadedImage.set(compressed);
        } catch {
          this.uploadedImage.set(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  onFreshmanImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const compressed = await this.compressImage(reader.result as string);
          this.uploadedFreshmanImage.set(compressed);
        } catch {
          this.uploadedFreshmanImage.set(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  onMemoryImageUpload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const compressed = await this.compressImage(reader.result as string);
          this.uploadedMemoryImage.set(compressed);
        } catch {
          this.uploadedMemoryImage.set(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async submitForm() {
    if (this.studentForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      try {
        let imageUrl = '';
        let freshmanImageUrl = '';

        if (this.uploadedImage()) {
          imageUrl = await this.uploadToCloudinary(this.uploadedImage()!);
        }
        if (this.uploadedFreshmanImage()) {
          freshmanImageUrl = await this.uploadToCloudinary(this.uploadedFreshmanImage()!);
        }

        const newStudent: Student = {
          name: this.studentForm.value.name,
          major: this.studentForm.value.major,
          university: this.studentForm.value.university,
          city: this.studentForm.value.city,
          track: 'New Graduate',
          updatedAt: new Date().toISOString(),
          status: 'active',
          ...(imageUrl ? { imageUrl } : {}),
          ...(freshmanImageUrl ? { freshmanImageUrl } : {}),
          ...(this.studentForm.value.caption ? { caption: this.studentForm.value.caption } : {})
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
      } catch (err) {
        console.error('Cloudinary upload failed:', err);
        alert('حدث خطأ أثناء رفع الصور، يرجى المحاولة مرة أخرى.');
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  async submitMemoryForm() {
    if (this.memoryForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      try {
        let imageUrl = '';
        if (this.uploadedMemoryImage()) {
          imageUrl = await this.uploadToCloudinary(this.uploadedMemoryImage()!);
        }

        const newMemory: Memory = {
          name: this.memoryForm.value.name,
          message: this.memoryForm.value.message,
          signatureFont: this.memoryForm.value.signatureFont,
          updatedAt: new Date().toISOString(),
          status: 'active',
          ...(imageUrl ? { imageUrl } : {})
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
      } catch (err) {
        console.error('Cloudinary upload failed:', err);
        alert('حدث خطأ أثناء رفع الصورة، يرجى المحاولة مرة أخرى.');
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  submitCapsuleForm() {
    if (this.capsuleForm.valid && !this.isSubmitting()) {
      this.isSubmitting.set(true);
      try {
        const newCapsule: TimeCapsule = {
          name: this.capsuleForm.value.name,
          message: this.capsuleForm.value.message,
          color: this.colors[Math.floor(Math.random() * this.colors.length)],
          date: new Date().toISOString(),
          status: 'active'
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
      } finally {
        this.isSubmitting.set(false);
      }
    }
  }

  async loadStudents() {
    // 1. Try to load from localStorage first for instant display
    const stored = localStorage.getItem('fci_students');
    let localStudents: Student[] = [];
    if (stored) {
      try {
        localStudents = JSON.parse(stored);
        this.students.set(localStudents);
      } catch (e) {
        console.error('Failed to parse cached students', e);
      }
    }

    // 2. Determine the latest timestamp in our local cache
    let latestTimestamp = '';
    if (localStudents.length > 0) {
      const timestamps = localStudents
        .map(s => s.updatedAt)
        .filter((t): t is string => !!t);
      if (timestamps.length > 0) {
        latestTimestamp = timestamps.reduce((max, t) => t > max ? t : max, '');
      }
    }

    // 3. Query Firestore for updates
    try {
      let q;
      if (latestTimestamp) {
        q = query(
          collection(db, 'students'), 
          where('updatedAt', '>', latestTimestamp)
        );
      } else {
        q = query(collection(db, 'students'));
      }

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty || !latestTimestamp) {
        const newStudents: Student[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Student;
          newStudents.push({
            ...data,
            updatedAt: data.updatedAt || new Date('2026-01-01').toISOString()
          });
        });

        if (newStudents.length > 0) {
          let updatedStudents: Student[];
          if (latestTimestamp) {
            // Merge: update existing or append new ones, avoiding duplicates by name
            const studentMap = new Map<string, Student>();
            localStudents.forEach(s => studentMap.set(s.name, s));
            newStudents.forEach(s => studentMap.set(s.name, s));
            updatedStudents = Array.from(studentMap.values()).filter(s => s.status !== 'deleted');
          } else {
            updatedStudents = newStudents.filter(s => s.status !== 'deleted');
          }

          this.students.set(updatedStudents);
          try {
            localStorage.setItem('fci_students', JSON.stringify(updatedStudents));
          } catch (e) {
            console.warn('Could not save students to local storage', e);
          }
        }
      }
    } catch (e) {
      console.warn('Firebase students failed, falling back to local storage', e);
    }
  }

  async loadMemories() {
    // 1. Try to load from localStorage first
    const stored = localStorage.getItem('fci_memories');
    let localMemories: Memory[] = [];
    if (stored) {
      try {
        localMemories = JSON.parse(stored);
        this.memories.set(localMemories);
      } catch (e) {
        console.error('Failed to parse cached memories', e);
      }
    }

    // 2. Determine the latest timestamp in local cache
    let latestTimestamp = '';
    if (localMemories.length > 0) {
      const timestamps = localMemories
        .map(m => m.updatedAt)
        .filter((t): t is string => !!t);
      if (timestamps.length > 0) {
        latestTimestamp = timestamps.reduce((max, t) => t > max ? t : max, '');
      }
    }

    // 3. Query Firestore for updates
    try {
      let q;
      if (latestTimestamp) {
        q = query(
          collection(db, 'memories'), 
          where('updatedAt', '>', latestTimestamp)
        );
      } else {
        q = query(collection(db, 'memories'));
      }

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty || !latestTimestamp) {
        const newMemories: Memory[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Memory;
          newMemories.push({
            ...data,
            updatedAt: data.updatedAt || new Date('2026-01-01').toISOString()
          });
        });

        if (newMemories.length > 0) {
          let updatedMemories: Memory[];
          if (latestTimestamp) {
            const memoryMap = new Map<string, Memory>();
            localMemories.forEach(m => memoryMap.set(m.name + '_' + m.message, m));
            newMemories.forEach(m => memoryMap.set(m.name + '_' + m.message, m));
            updatedMemories = Array.from(memoryMap.values()).filter(m => m.status !== 'deleted');
          } else {
            updatedMemories = newMemories.filter(m => m.status !== 'deleted');
          }

          this.memories.set(updatedMemories);
          try {
            localStorage.setItem('fci_memories', JSON.stringify(updatedMemories));
          } catch (e) {
            console.warn('Could not save memories to local storage', e);
          }
        }
      }
    } catch (e) {
      console.warn('Firebase memories failed, falling back to local storage', e);
    }
  }

  async loadTimeCapsules() {
    // 1. Try to load from localStorage first
    const stored = localStorage.getItem('fci_capsules');
    let localCapsules: TimeCapsule[] = [];
    if (stored) {
      try {
        localCapsules = JSON.parse(stored);
        this.timeCapsules.set(localCapsules);
      } catch (e) {
        console.error('Failed to parse cached capsules', e);
      }
    }

    // 2. Determine the latest timestamp (using 'date' field)
    let latestTimestamp = '';
    if (localCapsules.length > 0) {
      const timestamps = localCapsules
        .map(c => c.date)
        .filter((t): t is string => !!t);
      if (timestamps.length > 0) {
        latestTimestamp = timestamps.reduce((max, t) => t > max ? t : max, '');
      }
    }

    // 3. Query Firestore for updates
    try {
      let q;
      if (latestTimestamp) {
        q = query(
          collection(db, 'time_capsules'), 
          where('date', '>', latestTimestamp)
        );
      } else {
        q = query(collection(db, 'time_capsules'));
      }

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty || !latestTimestamp) {
        const newCapsules: TimeCapsule[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data() as TimeCapsule;
          newCapsules.push({
            ...data,
            date: data.date || new Date('2026-01-01').toISOString()
          });
        });

        if (newCapsules.length > 0) {
          let updatedCapsules: TimeCapsule[];
          if (latestTimestamp) {
            const capsuleMap = new Map<string, TimeCapsule>();
            localCapsules.forEach(c => capsuleMap.set(c.name + '_' + c.message, c));
            newCapsules.forEach(c => capsuleMap.set(c.name + '_' + c.message, c));
            updatedCapsules = Array.from(capsuleMap.values()).filter(c => c.status !== 'deleted');
          } else {
            updatedCapsules = newCapsules.filter(c => c.status !== 'deleted');
          }

          this.timeCapsules.set(updatedCapsules);
          try {
            localStorage.setItem('fci_capsules', JSON.stringify(updatedCapsules));
          } catch (e) {
            console.warn('Could not save capsules to local storage', e);
          }
        }
      }
    } catch (e) {
      console.warn('Firebase capsules failed, falling back to local storage', e);
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
