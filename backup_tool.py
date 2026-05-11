import os
import shutil
import tkinter as tk
from tkinter import messagebox, ttk, filedialog
import threading
import time
from datetime import datetime

class BackupApp:
    def __init__(self, root):
        self.root = root
        self.root.title("أداة النسخ الاحتياطي التلقائي")
        self.root.geometry("450x450")
        self.root.configure(bg="#f0f2f5")
        
        # تحديد المسارات تلقائياً بناءً على مكان ملف السكربت
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.source_path = script_dir
        self.dest_path = os.path.join(os.path.dirname(script_dir), os.path.basename(script_dir) + " backup")
        
        self.is_scheduled = False
        self.scheduler_thread = None

        # الواجهة
        self.setup_ui()
        print(f"Source: {self.source_path}")
        print(f"Dest: {self.dest_path}")

    def setup_ui(self):
        style = ttk.Style()
        style.configure("TButton", font=("Segoe UI", 10), padding=5)
        
        main_frame = tk.Frame(self.root, bg="#ffffff", padx=20, pady=20, relief="flat")
        main_frame.place(relx=0.5, rely=0.5, anchor="center", width=400, height=400)
        
        tk.Label(main_frame, text="نظام النسخ الاحتياطي", font=("Segoe UI", 16, "bold"), bg="#ffffff", fg="#1a73e8").pack(pady=10)
        
        # قسم اختيار المسار
        path_frame = tk.Frame(main_frame, bg="#ffffff")
        path_frame.pack(pady=10, fill="x")
        
        tk.Label(path_frame, text="مسار النسخ الاحتياطي:", font=("Segoe UI", 9), bg="#ffffff").pack(anchor="e")
        
        entry_frame = tk.Frame(path_frame, bg="#ffffff")
        entry_frame.pack(fill="x")
        
        self.dest_entry = tk.Entry(entry_frame, font=("Segoe UI", 9))
        self.dest_entry.insert(0, self.dest_path)
        self.dest_entry.pack(side="right", fill="x", expand=True, padx=(5, 0))
        
        self.btn_browse = tk.Button(entry_frame, text="تغيير", command=self.browse_dest,
                                     bg="#5f6368", fg="white", font=("Segoe UI", 8), 
                                     relief="flat", cursor="hand2")
        self.btn_browse.pack(side="right")
        
        # زر الحفظ الآن
        self.btn_now = tk.Button(main_frame, text="الحفظ الآن", command=self.manual_backup, 
                                 bg="#1a73e8", fg="white", font=("Segoe UI", 11, "bold"), 
                                 relief="flat", cursor="hand2", width=25)
        self.btn_now.pack(pady=10)
        
        # قسم الجدولة
        schedule_frame = tk.Frame(main_frame, bg="#ffffff")
        schedule_frame.pack(pady=15)
        
        tk.Label(schedule_frame, text="تكرار النسخ (بالدقائق):", font=("Segoe UI", 10), bg="#ffffff").pack(side="right", padx=5)
        self.time_entry = tk.Entry(schedule_frame, width=8, font=("Segoe UI", 10), justify="center")
        self.time_entry.insert(0, "10")
        self.time_entry.pack(side="right")
        
        self.btn_schedule = tk.Button(main_frame, text="بدء النسخ المجدول", command=self.toggle_schedule, 
                                     bg="#34a853", fg="white", font=("Segoe UI", 11, "bold"), 
                                     relief="flat", cursor="hand2", width=25)
        self.btn_schedule.pack(pady=5)
        
        # شريط الحالة
        self.status_label = tk.Label(main_frame, text="الحالة: جاهز", font=("Segoe UI", 9), bg="#ffffff", fg="#5f6368")
        self.status_label.pack(side="bottom", pady=5)

    def update_status(self, text, color="#5f6368"):
        """تحديث الحالة بشكل آمن من أي خيط (Thread)"""
        self.root.after(0, lambda: self.status_label.config(text=text, fg=color))

    def perform_backup(self):
        try:
            # تحديث المسار من المدخلات
            self.dest_path = self.dest_entry.get()
            
            if not os.path.exists(self.source_path):
                return False, "المجلد المصدري غير موجود!"

            # منع النسخ اللانهائي إذا كان المجلد الهدف داخل المجلد المصدري
            ignore_list = ['*.pyc', '__pycache__', '.git']
            abs_source = os.path.abspath(self.source_path)
            abs_dest = os.path.abspath(self.dest_path)
            
            if abs_dest.startswith(abs_source):
                # استخراج اسم المجلد النسبي إذا كان بالداخل
                rel_dest = os.path.relpath(abs_dest, abs_source)
                dest_root = rel_dest.split(os.sep)[0]
                ignore_list.append(dest_root)

            shutil.copytree(self.source_path, self.dest_path, dirs_exist_ok=True, 
                            ignore=shutil.ignore_patterns(*ignore_list))
            
            return True, f"تم النسخ بنجاح في {datetime.now().strftime('%H:%M:%S')}"
        except Exception as e:
            return False, f"خطأ: {str(e)}"

    def manual_backup(self):
        self.update_status("جاري النسخ...", "#fbbc05")
        self.root.update()
        success, message = self.perform_backup()
        if success:
            self.update_status(message, "#34a853")
            messagebox.showinfo("نجاح", "تمت عملية النسخ الاحتياطي بنجاح.")
        else:
            self.update_status(message, "#d93025")
            messagebox.showerror("خطأ", message)

    def toggle_schedule(self):
        if not self.is_scheduled:
            try:
                minutes = float(self.time_entry.get())
                if minutes <= 0: raise ValueError
            except ValueError:
                messagebox.showwarning("تنبيه", "يرجى إدخال عدد دقائق صحيح.")
                return

            self.is_scheduled = True
            self.btn_schedule.config(text="إيقاف الجدولة", bg="#d93025")
            self.time_entry.config(state="disabled")
            
            self.scheduler_thread = threading.Thread(target=self.run_scheduler, args=(minutes,), daemon=True)
            self.scheduler_thread.start()
            self.update_status(f"الجدولة تعمل كل {minutes} دقيقة", "#34a853")
        else:
            self.is_scheduled = False
            self.btn_schedule.config(text="بدء النسخ المجدول", bg="#34a853")
            self.time_entry.config(state="normal")
            self.update_status("تم إيقاف الجدولة", "#5f6368")

    def run_scheduler(self, minutes):
        while self.is_scheduled:
            # انتظار قبل البدء بالنسخة التالية (تجنب النسخ فور الضغط على الزر إذا لم يكن مطلوباً)
            # أو يمكن النسخ فوراً ثم الانتظار. هنا سنقوم بالنسخ فوراً.
            success, message = self.perform_backup()
            if success:
                self.update_status(f"آخر نسخ آلي: {datetime.now().strftime('%H:%M:%S')}", "#34a853")
            else:
                self.update_status(f"فشل النسخ الآلي: {message}", "#d93025")
            
            # الانتظار بالثواني مع التحقق من حالة الإيقاف كل ثانية
            for _ in range(int(minutes * 60)):
                if not self.is_scheduled: break
                time.sleep(1)

    def browse_dest(self):
        directory = filedialog.askdirectory(initialdir=os.path.dirname(self.dest_path))
        if directory:
            self.dest_entry.delete(0, tk.END)
            self.dest_entry.insert(0, directory)
            self.dest_path = directory

if __name__ == "__main__":
    root = tk.Tk()
    app = BackupApp(root)
    root.mainloop()
