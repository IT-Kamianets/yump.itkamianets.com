import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  ngOnInit(): void {
    void this.keepScreenAwake();
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      void this.configureAndroidSystemBars();
    }
  }

  private async keepScreenAwake(): Promise<void> {
    try {
      await KeepAwake.keepAwake();
    } catch {
      // Ignore if Wake Lock API isn't supported yet or needs user gesture
    }
  }

  private async configureAndroidSystemBars(): Promise<void> {
    try {
      await EdgeToEdge.setStatusBarColor({ color: '#0c1024' });
      await EdgeToEdge.setNavigationBarColor({ color: '#0c1024' });
      await SystemBars.setStyle({ style: SystemBarsStyle.Dark });
    } catch {
      // Fallback safely if native bridge isn't available
    }
  }
}
