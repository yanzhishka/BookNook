package com.booknook.converted;

import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.text.TextUtils;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.booknook.converted.data.AsyncRunner;
import com.booknook.converted.data.BookNookRepository;
import com.booknook.converted.data.ResultCallback;
import com.booknook.converted.data.SessionStore;
import com.booknook.converted.model.ActivityPost;
import com.booknook.converted.model.Annotation;
import com.booknook.converted.model.Book;
import com.booknook.converted.model.BookLookupResult;
import com.booknook.converted.model.Comment;
import com.booknook.converted.model.Recommendation;
import com.booknook.converted.model.ThreadPost;
import com.booknook.converted.model.ThreadReply;
import com.booknook.converted.model.User;
import com.booknook.converted.model.UserSession;
import com.booknook.converted.ui.AuroraView;
import com.booknook.converted.ui.Design;
import com.booknook.converted.ui.ImageLoader;
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.text.PDFTextStripper;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends android.app.Activity {
    private static final int CHARS_PER_PAGE = 2500;
    private static final int REQ_BOOK_FILE = 41;
    private static final int REQ_THREAD_IMAGE = 42;
    private static final int REQ_REPLY_IMAGE = 43;
    private static final int REQ_PROFILE_AVATAR = 44;
    private static final int REQ_PROFILE_BANNER = 45;

    private final AsyncRunner async = new AsyncRunner();
    private final ImageLoader imageLoader = new ImageLoader();
    private final List<Book> books = new ArrayList<>();
    private final List<ActivityPost> feed = new ArrayList<>();
    private final List<User> leaderboard = new ArrayList<>();
    private final List<ThreadPost> threads = new ArrayList<>();

    private SessionStore sessionStore;
    private BookNookRepository repository;
    private FrameLayout root;
    private FrameLayout pageHost;
    private AuroraView auroraView;
    private User user;
    private boolean authenticated;
    private boolean guest;
    private boolean dark;
    private boolean zenMode;
    private String activeTab = "home";
    private String libraryFilter = "all";
    private boolean libraryGrid = true;
    private EditText pendingBookContentInput;
    private String pendingThreadImage;
    private String pendingReplyImage;
    private User profileDraft;

    // React mapping:
    // useState -> Activity fields, useEffect -> async repository calls in onCreate/render methods,
    // localStorage -> SessionStore/SharedPreferences, Suspense loaders -> ProgressBar/loading cards.
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        root = findViewById(R.id.root);
        sessionStore = new SessionStore(this);
        PDFBoxResourceLoader.init(getApplicationContext());
        repository = new BookNookRepository(
                getString(R.string.local_api_base_url),
                getString(R.string.groq_api_key),
                sessionStore
        );
        dark = sessionStore.isDarkTheme();
        activeTab = sessionStore.getActiveTab();
        showLoading("Листаем страницы...");
        async.run(repository::getSession, new ResultCallback<UserSession>() {
            @Override
            public void onSuccess(UserSession value) {
                if (value == null || value.user == null) {
                    showAuth(false);
                    return;
                }
                authenticated = true;
                guest = false;
                user = value.user;
                books.clear();
                books.addAll(value.books);
                showApp();
            }

            @Override
            public void onError(Exception error) {
                showAuth(false);
            }
        });
    }

    private void showLoading(String message) {
        root.removeAllViews();
        root.setBackgroundColor(Design.pageBackground(dark));
        LinearLayout box = column(24);
        box.setGravity(Gravity.CENTER);
        ProgressBar progress = new ProgressBar(this);
        TextView label = Design.label(this, message, dark);
        box.addView(progress, lp(56, 56));
        box.addView(label);
        root.addView(box, match());
    }

    private void showAuth(boolean registering) {
        root.removeAllViews();
        authenticated = false;
        guest = false;

        FrameLayout layer = new FrameLayout(this);
        AuroraView authAurora = new AuroraView(this);
        authAurora.setDark(dark);
        layer.addView(authAurora, match());

        ScrollView scroll = new ScrollView(this);
        LinearLayout outer = column(0);
        outer.setGravity(Gravity.CENTER);
        outer.setPadding(dp(20), dp(28), dp(20), dp(28));
        scroll.addView(outer, matchWidthWrapHeight());

        LinearLayout card = column(16);
        card.setPadding(dp(28), dp(30), dp(28), dp(28));
        card.setBackground(Design.stroke(Design.cardBackground(dark), dark ? Design.STONE_800 : Design.STONE_100, 28, 1, this));
        card.setElevation(dp(16));

        TextView mark = Design.text(this, "B", 28, dark ? Design.STONE_900 : Color.WHITE, Typeface.BOLD);
        mark.setGravity(Gravity.CENTER);
        mark.setBackground(Design.rounded(dark ? Color.WHITE : Design.STONE_900, 16, this));
        LinearLayout.LayoutParams markLp = lp(64, 64);
        markLp.gravity = Gravity.CENTER_HORIZONTAL;
        card.addView(mark, markLp);

        TextView title = Design.text(this, "B.Nook", 32, Design.textColor(dark), Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        card.addView(title, matchWidthWrapHeight());
        TextView subtitle = Design.text(this, "Your personal digital sanctuary.", 15, Design.mutedText(dark), Typeface.NORMAL);
        subtitle.setGravity(Gravity.CENTER);
        card.addView(subtitle, matchWidthWrapHeight());

        EditText name = input("Full Name", false);
        if (registering) card.addView(name, matchWidthWrapHeight());
        EditText email = input("Email", false);
        email.setInputType(InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        EditText password = input("Password", true);
        card.addView(email, matchWidthWrapHeight());
        card.addView(password, matchWidthWrapHeight());

        Button submit = primaryButton(registering ? "Create Account  →" : "Sign In  →");
        submit.setOnClickListener(v -> {
            if (registering && blank(name)) {
                toast("Please fill in all fields");
                return;
            }
            if (blank(email) || blank(password)) {
                toast("Please fill in all fields");
                return;
            }
            showLoading(registering ? "Создаем аккаунт..." : "Входим...");
            if (registering) {
                async.run(() -> repository.register(text(email), text(password), text(name)), new ResultCallback<User>() {
                    @Override
                    public void onSuccess(User ignored) {
                        async.run(repository::getSession, new ResultCallback<UserSession>() {
                            @Override
                            public void onSuccess(UserSession session) {
                                if (session == null) {
                                    toast("Account created. Please sign in.");
                                    showAuth(false);
                                } else {
                                    applySession(session, false);
                                }
                            }

                            @Override
                            public void onError(Exception error) {
                                showAuth(false);
                            }
                        });
                    }

                    @Override
                    public void onError(Exception error) {
                        toast(error.getMessage());
                        showAuth(true);
                    }
                });
            } else {
                async.run(() -> repository.login(text(email), text(password)), new ResultCallback<UserSession>() {
                    @Override
                    public void onSuccess(UserSession session) {
                        applySession(session, false);
                    }

                    @Override
                    public void onError(Exception error) {
                        toast(error.getMessage());
                        showAuth(false);
                    }
                });
            }
        });
        card.addView(submit, matchWidthWrapHeight());

        Button guestButton = secondaryButton("👤  Continue as Guest");
        guestButton.setOnClickListener(v -> {
            user = guestUser();
            books.clear();
            authenticated = true;
            guest = true;
            activeTab = "feed";
            showApp();
        });
        card.addView(guestButton, matchWidthWrapHeight());

        TextView toggle = Design.text(this, registering ? "Already have an account? Sign In" : "New here? Create an account", 14, Design.mutedText(dark), Typeface.BOLD);
        toggle.setGravity(Gravity.CENTER);
        toggle.setPadding(0, dp(10), 0, 0);
        toggle.setOnClickListener(v -> showAuth(!registering));
        card.addView(toggle, matchWidthWrapHeight());

        int maxWidth = Math.min(dp(440), getResources().getDisplayMetrics().widthPixels - dp(32));
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(maxWidth, ViewGroup.LayoutParams.WRAP_CONTENT);
        cardLp.gravity = Gravity.CENTER;
        outer.addView(card, cardLp);
        layer.addView(scroll, match());
        root.addView(layer, match());
    }

    private void applySession(UserSession session, boolean asGuest) {
        user = session.user;
        books.clear();
        books.addAll(session.books);
        authenticated = true;
        guest = asGuest;
        showApp();
    }

    private void showApp() {
        root.removeAllViews();
        FrameLayout shell = new FrameLayout(this);
        auroraView = new AuroraView(this);
        auroraView.setDark(dark);
        shell.addView(auroraView, match());

        boolean wide = getResources().getConfiguration().screenWidthDp >= 760;
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(wide ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
        shell.addView(layout, match());

        if (wide && !zenMode) {
            layout.addView(sidebar(), lp(dp(288), ViewGroup.LayoutParams.MATCH_PARENT));
        }

        pageHost = new FrameLayout(this);
        LinearLayout.LayoutParams pageParams = wide
                ? new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1)
                : new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1);
        layout.addView(pageHost, pageParams);

        if (!wide && !zenMode) {
            shell.addView(bottomNav(), bottomNavLp());
        }

        root.addView(shell, match());
        renderCurrentTab();
    }

    private LinearLayout sidebar() {
        LinearLayout side = column(18);
        side.setPadding(dp(24), dp(32), dp(24), dp(24));
        side.setBackgroundColor(dark ? Color.argb(92, 12, 10, 9) : Color.argb(92, 255, 255, 255));

        TextView brand = Design.text(this, "B  B.NOOK", 26, Design.textColor(dark), Typeface.BOLD);
        brand.setOnClickListener(v -> changeTab("home"));
        side.addView(brand, matchWidthWrapHeight());

        LinearLayout nav = column(10);
        nav.setPadding(0, dp(20), 0, 0);
        addNavButton(nav, "home", "⌂", "Главная");
        addNavButton(nav, "library", "▣", "Библиотека");
        addNavButton(nav, "board", "⊞", "The Grid");
        addNavButton(nav, "oracle", "✦", "Оракул");
        addNavButton(nav, "feed", "◎", "Лента");
        side.addView(nav, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        LinearLayout themeRow = row(8);
        Button light = smallButton("☀", !dark);
        Button moon = smallButton("☾", dark);
        light.setOnClickListener(v -> setTheme(false));
        moon.setOnClickListener(v -> setTheme(true));
        themeRow.addView(light, new LinearLayout.LayoutParams(0, dp(44), 1));
        themeRow.addView(moon, new LinearLayout.LayoutParams(0, dp(44), 1));
        side.addView(themeRow, matchWidthWrapHeight());

        if (guest) {
            Button login = primaryButton("Войти");
            login.setOnClickListener(v -> showLoginPrompt());
            side.addView(login, matchWidthWrapHeight());
        } else {
            LinearLayout profile = row(12);
            profile.setGravity(Gravity.CENTER_VERTICAL);
            profile.setPadding(dp(12), dp(10), dp(12), dp(10));
            profile.setBackground(Design.rounded("profile".equals(activeTab) ? Design.AMBER : (dark ? Design.STONE_800 : Design.STONE_100), 20, this));
            ImageView avatar = image(dp(42), dp(42), 21);
            imageLoader.load(user.avatar, avatar);
            profile.addView(avatar);
            LinearLayout names = column(2);
            names.addView(Design.text(this, user.name, 13, "profile".equals(activeTab) ? Color.WHITE : Design.textColor(dark), Typeface.BOLD));
            names.addView(Design.text(this, "Уровень " + user.level, 10, "profile".equals(activeTab) ? Color.WHITE : Design.STONE_400, Typeface.BOLD));
            profile.addView(names, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            profile.setOnClickListener(v -> changeTab("profile"));
            side.addView(profile, matchWidthWrapHeight());

            Button logout = secondaryButton("Выйти");
            logout.setOnClickListener(v -> logout());
            side.addView(logout, matchWidthWrapHeight());
        }
        return side;
    }

    private FrameLayout bottomNav() {
        FrameLayout wrap = new FrameLayout(this);
        LinearLayout bar = row(4);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(8), dp(8), dp(8), dp(8));
        bar.setBackground(Design.stroke(dark ? Color.argb(232, 28, 25, 23) : Color.argb(232, 255, 255, 255), dark ? Design.STONE_800 : Design.STONE_200, 28, 1, this));
        addBottomButton(bar, "home", "⌂");
        addBottomButton(bar, "library", "▣");
        addBottomButton(bar, "board", "⊞");
        addBottomButton(bar, "oracle", "✦");
        addBottomButton(bar, "feed", "◎");
        addBottomButton(bar, "profile", "●");
        wrap.addView(bar, match());
        return wrap;
    }

    private void addNavButton(LinearLayout parent, String id, String icon, String label) {
        boolean active = id.equals(activeTab);
        TextView button = Design.text(this, icon + "  " + label, 13, active ? (dark ? Design.STONE_900 : Color.WHITE) : Design.STONE_400, Typeface.BOLD);
        button.setGravity(Gravity.CENTER_VERTICAL);
        button.setLetterSpacing(0.12f);
        button.setAllCaps(true);
        button.setPadding(dp(18), 0, dp(12), 0);
        button.setBackground(Design.rounded(active ? (dark ? Color.WHITE : Design.STONE_900) : Color.TRANSPARENT, 24, this));
        button.setOnClickListener(v -> changeTab(id));
        parent.addView(button, lp(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));
    }

    private void addBottomButton(LinearLayout parent, String id, String icon) {
        boolean active = id.equals(activeTab);
        TextView button = Design.text(this, icon, 21, active ? (dark ? Design.STONE_900 : Color.WHITE) : Design.STONE_400, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setBackground(Design.rounded(active ? (dark ? Color.WHITE : Design.STONE_900) : Color.TRANSPARENT, 22, this));
        button.setOnClickListener(v -> changeTab(id));
        parent.addView(button, new LinearLayout.LayoutParams(0, dp(48), 1));
    }

    private void changeTab(String tab) {
        if (guest && !("feed".equals(tab) || "board".equals(tab))) {
            showLoginPrompt();
            return;
        }
        activeTab = tab;
        sessionStore.saveActiveTab(tab);
        showApp();
    }

    private void renderCurrentTab() {
        pageHost.removeAllViews();
        switch (activeTab) {
            case "library":
                pageHost.addView(libraryPage(), match());
                break;
            case "board":
                pageHost.addView(boardPage(), match());
                break;
            case "oracle":
                pageHost.addView(oraclePage(), match());
                break;
            case "feed":
                pageHost.addView(feedPage(), match());
                break;
            case "profile":
                pageHost.addView(profilePage(), match());
                break;
            case "home":
            default:
                pageHost.addView(dashboardPage(), match());
                break;
        }
        if ("board".equals(activeTab)) addZenToggle();
    }

    private void addZenToggle() {
        TextView zen = Design.text(this, zenMode ? "⚡" : "◌", 20, zenMode ? Color.WHITE : Design.STONE_400, Typeface.BOLD);
        zen.setGravity(Gravity.CENTER);
        zen.setBackground(Design.rounded(zenMode ? Design.AMBER : (dark ? Design.STONE_900 : Color.WHITE), 18, this));
        zen.setElevation(dp(12));
        zen.setOnClickListener(v -> {
            zenMode = !zenMode;
            showApp();
        });
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(56), dp(56), Gravity.TOP | Gravity.END);
        params.setMargins(0, dp(24), dp(24), 0);
        root.addView(zen, params);
    }

    private ScrollView dashboardPage() {
        LinearLayout page = pageColumn();
        String greeting = greeting();
        TextView title = Design.text(this, greeting + ",\n" + firstName(user.name), isWide() ? 58 : 42, Design.textColor(dark), Typeface.BOLD);
        page.addView(title, matchWidthWrapHeight());
        TextView sub = Design.text(this, "Сегодня прекрасный день, чтобы дочитать главу.", 18, Design.mutedText(dark), Typeface.BOLD);
        page.addView(sub, matchWidthWrapHeight());
        page.addView(xpCard(), matchWidthWrapHeight());
        page.addView(currentBookCard(), matchWidthWrapHeight());

        LinearLayout stats = isWide() ? row(18) : column(18);
        stats.addView(statCard("Ударная серия", String.valueOf(user.streakDays), "Дней непрерывного чтения", true), weightOrMatch());
        stats.addView(statCard("Цель 2024", user.booksReadThisYear + " / 20", "Прочитано книг", false), weightOrMatch());
        page.addView(stats, matchWidthWrapHeight());

        LinearLayout community = card(Design.cardBackground(dark), 28, 18);
        TextView h = sectionTitle("Сообщество");
        community.addView(h);
        TextView loading = Design.text(this, "Загружаем ленту...", 14, Design.STONE_400, Typeface.BOLD);
        community.addView(loading);
        page.addView(community, matchWidthWrapHeight());
        async.run(() -> repository.getFeed(6), new ResultCallback<List<ActivityPost>>() {
            @Override
            public void onSuccess(List<ActivityPost> value) {
                community.removeView(loading);
                if (value.isEmpty()) {
                    community.addView(Design.text(MainActivity.this, "Лента пока пуста.", 16, Design.STONE_400, Typeface.ITALIC));
                } else {
                    for (int i = 0; i < Math.min(4, value.size()); i++) {
                        community.addView(activityMini(value.get(i)), matchWidthWrapHeight());
                    }
                }
            }

            @Override
            public void onError(Exception error) {
                loading.setText("Не удалось загрузить ленту.");
            }
        });
        return scroll(page);
    }

    private LinearLayout xpCard() {
        int nextLevelXp = Math.max(1, user.level) * 1000;
        int levelProgress = Math.min(100, Math.round((user.xp * 100f) / nextLevelXp));
        LinearLayout card = card(dark ? Color.argb(150, 12, 10, 9) : Color.argb(150, 255, 255, 255), 36, 18);
        LinearLayout row = row(18);
        TextView level = Design.text(this, "Lvl\n" + user.level, 26, Color.WHITE, Typeface.BOLD);
        level.setGravity(Gravity.CENTER);
        level.setBackground(Design.gradient(Design.AMBER, Design.ORANGE, 24, this));
        row.addView(level, lp(96, 96));
        LinearLayout detail = column(8);
        detail.addView(Design.text(this, user.xp + " XP / " + nextLevelXp + " XP", 12, Design.textColor(dark), Typeface.BOLD));
        ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        bar.setMax(100);
        bar.setProgress(levelProgress);
        detail.addView(bar, lp(ViewGroup.LayoutParams.MATCH_PARENT, dp(14)));
        detail.addView(Design.text(this, "До " + (user.level + 1) + " уровня: " + (nextLevelXp - user.xp) + " XP", 11, Design.STONE_400, Typeface.BOLD));
        row.addView(detail, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        card.addView(row);
        return card;
    }

    private LinearLayout currentBookCard() {
        Book current = books.stream()
                .filter(b -> "reading".equals(b.status))
                .max(Comparator.comparingInt(b -> b.progress))
                .orElse(null);
        LinearLayout card = card(Design.cardBackground(dark), 36, 22);
        if (current == null) {
            TextView empty = Design.text(this, "Ваша полка пуста. Самое время начать новую историю.", 26, Design.STONE_400, Typeface.ITALIC);
            empty.setGravity(Gravity.CENTER);
            card.addView(empty, matchWidthWrapHeight());
            Button find = primaryButton("Найти книгу");
            find.setOnClickListener(v -> changeTab("library"));
            card.addView(find, matchWidthWrapHeight());
            return card;
        }
        LinearLayout row = isWide() ? row(24) : column(18);
        ImageView cover = image(dp(150), dp(225), 26);
        imageLoader.load(current.coverUrl, cover);
        cover.setOnClickListener(v -> showReader(current));
        row.addView(cover);
        LinearLayout copy = column(12);
        copy.addView(Design.label(this, "Сейчас в читалке", dark));
        copy.addView(Design.text(this, current.title, isWide() ? 34 : 28, Design.textColor(dark), Typeface.BOLD));
        copy.addView(Design.text(this, "от " + current.author, 17, Design.mutedText(dark), Typeface.ITALIC));
        Button continueButton = primaryButton("Продолжить чтение  →");
        continueButton.setOnClickListener(v -> showReader(current));
        copy.addView(continueButton, matchWidthWrapHeight());
        row.addView(copy, weightOrMatch());
        card.addView(row);
        return card;
    }

    private ScrollView libraryPage() {
        LinearLayout page = pageColumn();
        LinearLayout header = isWide() ? row(18) : column(14);
        LinearLayout titles = column(6);
        titles.addView(Design.text(this, "Библиотека", 46, Design.textColor(dark), Typeface.BOLD));
        titles.addView(Design.text(this, "Ваше убежище, страница за страницей.", 16, Design.mutedText(dark), Typeface.NORMAL));
        header.addView(titles, weightOrMatch());
        Button add = primaryButton("+  Добавить");
        add.setOnClickListener(v -> showAddBookDialog());
        header.addView(add, isWide() ? lp(dp(170), dp(54)) : matchWidthWrapHeight());
        page.addView(header, matchWidthWrapHeight());
        page.addView(libraryFilters(), matchWidthWrapHeight());

        List<Book> filtered = new ArrayList<>();
        for (Book book : books) {
            if ("all".equals(libraryFilter) || libraryFilter.equals(book.status)) filtered.add(book);
        }
        if (filtered.isEmpty()) {
            LinearLayout empty = card(Color.TRANSPARENT, 28, 28);
            empty.setBackground(Design.stroke(Color.TRANSPARENT, dark ? Design.STONE_800 : Design.STONE_200, 28, 2, this));
            TextView text = Design.text(this, "Здесь пока пусто", 16, Design.STONE_400, Typeface.BOLD);
            text.setGravity(Gravity.CENTER);
            empty.addView(text, matchWidthWrapHeight());
            page.addView(empty, matchWidthWrapHeight());
        } else {
            int columns = isWide() && libraryGrid ? 3 : 1;
            LinearLayout list = column(14);
            for (int i = 0; i < filtered.size(); i += columns) {
                LinearLayout row = columns > 1 ? row(14) : column(14);
                for (int j = 0; j < columns && i + j < filtered.size(); j++) {
                    row.addView(bookCard(filtered.get(i + j)), columns > 1 ? new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1) : matchWidthWrapHeight());
                }
                list.addView(row, matchWidthWrapHeight());
            }
            page.addView(list, matchWidthWrapHeight());
        }
        return scroll(page);
    }

    private HorizontalScrollView libraryFilters() {
        HorizontalScrollView hsv = new HorizontalScrollView(this);
        hsv.setHorizontalScrollBarEnabled(false);
        LinearLayout row = row(6);
        row.setPadding(dp(8), dp(8), dp(8), dp(8));
        row.setBackground(Design.stroke(dark ? Color.argb(210, 28, 25, 23) : Color.argb(120, 255, 255, 255), dark ? Design.STONE_800 : Design.STONE_100, 24, 1, this));
        String[][] tabs = {{"all", "Все"}, {"reading", "Читаю"}, {"want_to_read", "В планах"}, {"completed", "Прочитано"}};
        for (String[] tab : tabs) {
            TextView chip = Design.chip(this, tab[1], tab[0].equals(libraryFilter), dark);
            chip.setOnClickListener(v -> {
                libraryFilter = tab[0];
                renderCurrentTab();
            });
            row.addView(chip);
        }
        Button mode = smallButton(libraryGrid ? "▦" : "☰", false);
        mode.setOnClickListener(v -> {
            libraryGrid = !libraryGrid;
            renderCurrentTab();
        });
        row.addView(mode, lp(dp(50), dp(42)));
        hsv.addView(row, matchWidthWrapHeight());
        return hsv;
    }

    private LinearLayout bookCard(Book book) {
        LinearLayout card = card(Design.cardBackground(dark), 30, 16);
        LinearLayout top = libraryGrid ? column(12) : row(14);
        ImageView cover = image(libraryGrid ? dp(190) : dp(72), libraryGrid ? dp(285) : dp(108), 20);
        imageLoader.load(book.coverUrl, cover);
        cover.setOnClickListener(v -> showReader(book));
        top.addView(cover);
        LinearLayout copy = column(7);
        copy.addView(Design.text(this, book.title, libraryGrid ? 20 : 17, Design.textColor(dark), Typeface.BOLD));
        copy.addView(Design.text(this, book.author, 10, Design.STONE_400, Typeface.BOLD));
        copy.addView(Design.text(this, book.progress + "% • " + statusLabel(book.status), 11, Design.mutedText(dark), Typeface.BOLD));
        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgress(book.progress);
        copy.addView(progress, lp(ViewGroup.LayoutParams.MATCH_PARENT, dp(8)));
        LinearLayout actions = row(6);
        actions.addView(statusButton("▶", book, "reading"));
        actions.addView(statusButton("⌑", book, "want_to_read"));
        actions.addView(statusButton("✓", book, "completed"));
        Button delete = smallButton("×", false);
        delete.setOnClickListener(v -> confirm("Удалить книгу?", "Вы собираетесь навсегда удалить \"" + book.title + "\".", () -> {
            async.run(() -> {
                repository.deleteBook(book.id);
                return null;
            }, new SimpleCallback<>(ignored -> {
                books.remove(book);
                renderCurrentTab();
            }));
        }));
        actions.addView(delete, lp(dp(42), dp(42)));
        copy.addView(actions, matchWidthWrapHeight());
        top.addView(copy, libraryGrid ? matchWidthWrapHeight() : new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        card.addView(top);
        return card;
    }

    private Button statusButton(String text, Book book, String status) {
        Button button = smallButton(text, status.equals(book.status));
        button.setOnClickListener(v -> updateBookStatus(book, status));
        return button;
    }

    private void updateBookStatus(Book book, String status) {
        boolean completedNow = !"completed".equals(book.status) && "completed".equals(status);
        book.status = status;
        book.progress = "completed".equals(status) ? 100 : ("want_to_read".equals(status) ? 0 : Math.max(1, book.progress));
        async.run(() -> repository.updateBook(book, user.id), new SimpleCallback<>(saved -> {
            if (completedNow) awardXp(100);
            renderCurrentTab();
        }));
    }

    private void showAddBookDialog() {
        AlertDialog dialog = new AlertDialog.Builder(this).create();
        LinearLayout view = column(14);
        view.setPadding(dp(22), dp(20), dp(22), dp(16));
        TextView title = Design.text(this, "Добавить книгу", 26, Design.textColor(dark), Typeface.BOLD);
        view.addView(title);
        EditText query = input("Название книги или автор...", false);
        Button search = secondaryButton("Глобальный поиск");
        LinearLayout results = column(10);
        ScrollView resultsScroll = new ScrollView(this);
        resultsScroll.addView(results);
        EditText bookTitle = input("Название книги", false);
        EditText author = input("Автор", false);
        EditText cover = input("Ссылка на обложку", false);
        EditText content = input("Текст книги", false);
        content.setMinLines(6);
        content.setGravity(Gravity.TOP | Gravity.START);
        pendingBookContentInput = content;
        Button upload = secondaryButton("Загрузить PDF / EPUB / TXT");
        upload.setOnClickListener(v -> pickFile(REQ_BOOK_FILE, "*/*"));
        Button save = primaryButton("Сохранить в библиотеку");
        save.setOnClickListener(v -> {
            if (blank(bookTitle) || blank(author)) {
                toast("Укажите название и автора.");
                return;
            }
            Book book = new Book();
            book.title = text(bookTitle);
            book.author = text(author);
            book.coverUrl = blank(cover) ? fallbackCover(book.title) : text(cover);
            book.content = blank(content) ? "Текст книги пока не добавлен..." : text(content);
            book.status = "want_to_read";
            book.progress = 0;
            book.currentPage = 1;
            book.totalPages = Math.max(1, (int) Math.ceil(book.content.length() / (double) CHARS_PER_PAGE));
            ProgressDialog progress = ProgressDialog.show(this, "", "Сохраняем книгу...", true);
            async.run(() -> repository.addBook(book, user.id), new ResultCallback<Book>() {
                @Override
                public void onSuccess(Book saved) {
                    progress.dismiss();
                    books.add(0, saved);
                    awardXp(10);
                    dialog.dismiss();
                    renderCurrentTab();
                }

                @Override
                public void onError(Exception error) {
                    progress.dismiss();
                    toast(error.getMessage());
                }
            });
        });
        search.setOnClickListener(v -> {
            if (blank(query)) return;
            results.removeAllViews();
            results.addView(Design.text(this, "Просматриваем Open Library...", 14, Design.STONE_400, Typeface.BOLD));
            async.run(() -> repository.searchBooks(text(query)), new ResultCallback<List<BookLookupResult>>() {
                @Override
                public void onSuccess(List<BookLookupResult> found) {
                    results.removeAllViews();
                    if (found.isEmpty()) results.addView(Design.text(MainActivity.this, "Ничего не найдено.", 14, Design.STONE_400, Typeface.BOLD));
                    for (BookLookupResult item : found) {
                        results.addView(searchResult(item, bookTitle, author, cover, content, dialog), matchWidthWrapHeight());
                    }
                }

                @Override
                public void onError(Exception error) {
                    results.removeAllViews();
                    results.addView(Design.text(MainActivity.this, error.getMessage(), 13, Design.ROSE, Typeface.BOLD));
                }
            });
        });
        view.addView(query, matchWidthWrapHeight());
        view.addView(search, matchWidthWrapHeight());
        view.addView(resultsScroll, lp(ViewGroup.LayoutParams.MATCH_PARENT, dp(210)));
        view.addView(upload, matchWidthWrapHeight());
        view.addView(bookTitle, matchWidthWrapHeight());
        view.addView(author, matchWidthWrapHeight());
        view.addView(cover, matchWidthWrapHeight());
        view.addView(content, matchWidthWrapHeight());
        view.addView(save, matchWidthWrapHeight());
        dialog.setView(view);
        dialog.show();
    }

    private View searchResult(BookLookupResult item, EditText bookTitle, EditText author, EditText cover, EditText content, AlertDialog dialog) {
        LinearLayout card = row(12);
        card.setPadding(dp(10), dp(10), dp(10), dp(10));
        card.setBackground(Design.stroke(dark ? Design.STONE_900 : Color.WHITE, dark ? Design.STONE_800 : Design.STONE_100, 18, 1, this));
        ImageView image = image(dp(50), dp(74), 10);
        imageLoader.load(item.coverUrl, image);
        card.addView(image);
        LinearLayout copy = column(4);
        copy.addView(Design.text(this, item.title, 15, Design.textColor(dark), Typeface.BOLD));
        copy.addView(Design.text(this, item.author, 12, Design.STONE_400, Typeface.NORMAL));
        copy.addView(Design.text(this, (item.firstPublishYear == 0 ? "год ?" : String.valueOf(item.firstPublishYear)) + " • " + (item.pageCount == 0 ? "?" : item.pageCount) + " стр.", 10, Design.STONE_400, Typeface.BOLD));
        card.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        card.setOnClickListener(v -> {
            bookTitle.setText(item.title);
            author.setText(item.author);
            cover.setText(item.coverUrl);
            content.setText(item.description == null ? "" : item.description + "\n\n");
            if (item.hasReadableText) {
                Toast.makeText(this, "Ищем доступный текст...", Toast.LENGTH_SHORT).show();
                async.run(() -> repository.fetchBookText(item.iaIds), new ResultCallback<String>() {
                    @Override
                    public void onSuccess(String value) {
                        if (value != null && !value.trim().isEmpty()) content.setText(value);
                    }

                    @Override
                    public void onError(Exception error) {
                        content.append("[Полный текст не найден автоматически.]");
                    }
                });
            }
        });
        return card;
    }

    private void showReader(Book book) {
        root.removeAllViews();
        int bg = readerBg();
        root.setBackgroundColor(bg);
        LinearLayout outer = column(0);
        outer.setBackgroundColor(bg);

        LinearLayout header = row(12);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), dp(12), dp(12), dp(8));
        Button back = smallButton("‹", false);
        back.setTextSize(28);
        back.setOnClickListener(v -> showApp());
        header.addView(back, lp(dp(52), dp(52)));
        LinearLayout titleBox = column(2);
        titleBox.addView(Design.text(this, book.title, 18, readerText(), Typeface.BOLD));
        titleBox.addView(Design.text(this, book.currentPage + " / " + book.totalPages + " СТРАНИЦ", 10, readerMuted(), Typeface.BOLD));
        header.addView(titleBox, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        Button settings = smallButton("Aa", false);
        settings.setOnClickListener(v -> showReaderSettings(book));
        header.addView(settings, lp(dp(58), dp(52)));
        outer.addView(header, matchWidthWrapHeight());

        ScrollView scroller = new ScrollView(this);
        LinearLayout page = column(20);
        page.setPadding(dp(24), dp(24), dp(24), dp(120));
        TextView text = Design.text(this, pageText(book), sessionStore.getReaderFontSize(), readerText(), Typeface.NORMAL);
        text.setLineSpacing(dp(8), 1.25f);
        text.setTextIsSelectable(true);
        String font = sessionStore.getReaderFont();
        text.setTypeface("mono".equals(font) ? Typeface.MONOSPACE : ("sans".equals(font) ? Typeface.SANS_SERIF : Typeface.SERIF));
        page.addView(text, matchWidthWrapHeight());

        LinearLayout nav = row(10);
        Button prev = secondaryButton("‹ Назад");
        prev.setEnabled(book.currentPage > 1);
        prev.setOnClickListener(v -> changePage(book, book.currentPage - 1));
        Button note = primaryButton("Создать заметку");
        note.setOnClickListener(v -> showNoteDialog(book, selectedText(text)));
        Button next = secondaryButton("Далее ›");
        next.setEnabled(book.currentPage < book.totalPages);
        next.setOnClickListener(v -> changePage(book, book.currentPage + 1));
        nav.addView(prev, new LinearLayout.LayoutParams(0, dp(54), 1));
        nav.addView(note, new LinearLayout.LayoutParams(0, dp(54), 1));
        nav.addView(next, new LinearLayout.LayoutParams(0, dp(54), 1));
        page.addView(nav, matchWidthWrapHeight());

        if (!book.annotations.isEmpty()) {
            page.addView(sectionTitle("Заметки"));
            for (Annotation annotation : book.annotations) {
                page.addView(annotationCard(book, annotation), matchWidthWrapHeight());
            }
        }
        scroller.addView(page);
        outer.addView(scroller, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        root.addView(outer, match());
    }

    private void changePage(Book book, int newPage) {
        int clamped = Math.max(1, Math.min(book.totalPages, newPage));
        if (clamped == book.currentPage) return;
        boolean completedNow = !"completed".equals(book.status) && clamped == book.totalPages;
        book.currentPage = clamped;
        book.progress = (int) Math.floor((clamped * 100f) / book.totalPages);
        if (clamped == book.totalPages) book.status = "completed";
        else if (clamped > 1) book.status = "reading";
        async.run(() -> repository.updateBook(book, user.id), new SimpleCallback<>(saved -> {
            if (completedNow) awardXp(100);
            showReader(book);
        }));
    }

    private void showReaderSettings(Book book) {
        LinearLayout view = column(16);
        view.setPadding(dp(22), dp(20), dp(22), dp(16));
        view.addView(Design.text(this, "Параметры", 24, Design.textColor(dark), Typeface.BOLD));
        TextView size = Design.text(this, "Размер текста: " + sessionStore.getReaderFontSize() + "px", 14, Design.mutedText(dark), Typeface.BOLD);
        view.addView(size);
        LinearLayout row = row(8);
        Button minus = secondaryButton("-");
        Button plus = secondaryButton("+");
        minus.setOnClickListener(v -> {
            sessionStore.saveReaderFontSize(Math.max(12, sessionStore.getReaderFontSize() - 2));
            showReader(book);
        });
        plus.setOnClickListener(v -> {
            sessionStore.saveReaderFontSize(Math.min(42, sessionStore.getReaderFontSize() + 2));
            showReader(book);
        });
        row.addView(minus, new LinearLayout.LayoutParams(0, dp(52), 1));
        row.addView(plus, new LinearLayout.LayoutParams(0, dp(52), 1));
        view.addView(row);
        LinearLayout fonts = row(8);
        for (String font : new String[]{"serif", "sans", "mono"}) {
            Button button = smallButton(font, font.equals(sessionStore.getReaderFont()));
            button.setOnClickListener(v -> {
                sessionStore.saveReaderFont(font);
                showReader(book);
            });
            fonts.addView(button, new LinearLayout.LayoutParams(0, dp(48), 1));
        }
        view.addView(fonts);
        LinearLayout themes = row(8);
        for (String theme : new String[]{"parchment", "sepia", "night", "solar"}) {
            Button button = smallButton(theme, theme.equals(sessionStore.getReaderTheme()));
            button.setOnClickListener(v -> {
                sessionStore.saveReaderTheme(theme);
                showReader(book);
            });
            themes.addView(button, new LinearLayout.LayoutParams(0, dp(48), 1));
        }
        view.addView(themes);
        new AlertDialog.Builder(this).setView(view).show();
    }

    private void showNoteDialog(Book book, String selected) {
        LinearLayout view = column(14);
        view.setPadding(dp(20), dp(18), dp(20), dp(14));
        view.addView(Design.text(this, "Фиксация мысли", 26, Design.textColor(dark), Typeface.BOLD));
        EditText quote = input("Цитата", false);
        quote.setMinLines(3);
        quote.setText(selected);
        EditText note = input("Комментарий", false);
        note.setMinLines(4);
        Spinner color = new Spinner(this);
        color.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, new String[]{"amber", "rose", "emerald", "sky"}));
        view.addView(quote, matchWidthWrapHeight());
        view.addView(note, matchWidthWrapHeight());
        view.addView(color, matchWidthWrapHeight());
        new AlertDialog.Builder(this)
                .setView(view)
                .setNegativeButton("Отмена", null)
                .setPositiveButton("Сохранить", (dialog, which) -> {
                    if (blank(quote) || blank(note)) return;
                    Annotation annotation = new Annotation(String.valueOf(System.currentTimeMillis()), text(quote), text(note), String.valueOf(color.getSelectedItem()), System.currentTimeMillis());
                    book.annotations.add(annotation);
                    async.run(() -> {
                        repository.updateBook(book, user.id);
                        return null;
                    }, new SimpleCallback<>(ignored -> showReader(book)));
                }).show();
    }

    private LinearLayout annotationCard(Book book, Annotation annotation) {
        LinearLayout card = card(dark ? Color.argb(30, 255, 255, 255) : Color.WHITE, 26, 16);
        card.addView(Design.text(this, "«" + annotation.quote + "»", 15, Design.mutedText(dark), Typeface.ITALIC));
        card.addView(Design.text(this, annotation.comment, 17, Design.textColor(dark), Typeface.BOLD));
        LinearLayout actions = row(8);
        Button share = secondaryButton("В ленту");
        share.setOnClickListener(v -> async.run(() -> repository.shareAnnotation(user, book, annotation), new SimpleCallback<>(ignored -> toast("Заметка опубликована"))));
        Button delete = secondaryButton("Удалить");
        delete.setOnClickListener(v -> confirm("Удалить заметку?", "Это действие нельзя отменить.", () -> {
            book.annotations.remove(annotation);
            async.run(() -> {
                repository.deleteAnnotation(annotation.id);
                repository.updateBook(book, user.id);
                return null;
            }, new SimpleCallback<>(ignored -> showReader(book)));
        }));
        actions.addView(share, new LinearLayout.LayoutParams(0, dp(48), 1));
        actions.addView(delete, new LinearLayout.LayoutParams(0, dp(48), 1));
        card.addView(actions);
        return card;
    }

    private ScrollView feedPage() {
        LinearLayout page = pageColumn();
        page.addView(Design.text(this, "Сообщество", 44, Design.textColor(dark), Typeface.BOLD));
        page.addView(Design.text(this, "Мысли, цитаты и книжные открытия в одном месте.", 16, Design.mutedText(dark), Typeface.NORMAL));

        page.addView(composerCard(), matchWidthWrapHeight());
        LinearLayout feedList = column(14);
        feedList.addView(Design.text(this, "Загружаем ленту...", 14, Design.STONE_400, Typeface.BOLD));
        page.addView(feedList, matchWidthWrapHeight());
        async.run(() -> {
            List<ActivityPost> posts = repository.getFeed(15);
            List<User> leaders = repository.getLeaderboard(5);
            feed.clear();
            feed.addAll(posts);
            leaderboard.clear();
            leaderboard.addAll(leaders);
            return posts;
        }, new ResultCallback<List<ActivityPost>>() {
            @Override
            public void onSuccess(List<ActivityPost> value) {
                feedList.removeAllViews();
                if (value.isEmpty()) {
                    feedList.addView(Design.text(MainActivity.this, "Здесь пока пусто.", 16, Design.STONE_400, Typeface.BOLD));
                } else {
                    for (ActivityPost post : value) feedList.addView(activityCard(post), matchWidthWrapHeight());
                }
                if (!leaderboard.isEmpty()) page.addView(leaderboardCard(), matchWidthWrapHeight());
            }

            @Override
            public void onError(Exception error) {
                feedList.removeAllViews();
                feedList.addView(Design.text(MainActivity.this, "Не удалось загрузить ленту: " + error.getMessage(), 14, Design.ROSE, Typeface.BOLD));
            }
        });
        return scroll(page);
    }

    private LinearLayout composerCard() {
        LinearLayout card = card(Design.cardBackground(dark), 28, 16);
        if (guest) {
            card.addView(Design.text(this, "Войдите, чтобы создавать посты, лайкать и комментировать.", 15, Design.mutedText(dark), Typeface.BOLD));
            Button login = primaryButton("Войти");
            login.setOnClickListener(v -> showLoginPrompt());
            card.addView(login, matchWidthWrapHeight());
            return card;
        }
        LinearLayout top = row(12);
        ImageView avatar = image(dp(50), dp(50), 25);
        imageLoader.load(user.avatar, avatar);
        top.addView(avatar);
        EditText postText = input("О чем вы думаете?", false);
        postText.setMinLines(3);
        top.addView(postText, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        card.addView(top);
        Spinner spinner = new Spinner(this);
        List<String> options = new ArrayList<>();
        options.add("Без привязки к книге");
        for (Book book : books) options.add(book.title);
        spinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, options));
        card.addView(spinner, matchWidthWrapHeight());
        Button publish = primaryButton("Опубликовать");
        publish.setOnClickListener(v -> {
            if (blank(postText)) return;
            int selected = spinner.getSelectedItemPosition();
            ActivityPost activity = new ActivityPost();
            activity.id = "temp-" + System.currentTimeMillis();
            activity.user = user;
            activity.book = selected > 0 ? books.get(selected - 1) : null;
            activity.type = selected > 0 ? "note" : "review";
            activity.content = text(postText);
            activity.timestamp = "Только что";
            async.run(() -> repository.createActivity(activity), new SimpleCallback<>(created -> {
                awardXp(20);
                renderCurrentTab();
            }));
        });
        card.addView(publish, matchWidthWrapHeight());
        return card;
    }

    private LinearLayout activityCard(ActivityPost activity) {
        LinearLayout card = card(Design.cardBackground(dark), 28, 16);
        LinearLayout header = row(12);
        ImageView avatar = image(dp(48), dp(48), 24);
        imageLoader.load(activity.user.avatar, avatar);
        header.addView(avatar);
        LinearLayout names = column(2);
        names.addView(Design.text(this, activity.user.name, 14, Design.textColor(dark), Typeface.BOLD));
        names.addView(Design.text(this, activity.timestamp, 10, Design.STONE_400, Typeface.BOLD));
        header.addView(names, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        if (canDelete(activity)) {
            Button delete = smallButton("×", false);
            delete.setOnClickListener(v -> confirm("Удалить пост", "Вы уверены?", () -> async.run(() -> {
                repository.deleteActivity(activity.id);
                return null;
            }, new SimpleCallback<>(ignored -> renderCurrentTab()))));
            header.addView(delete, lp(dp(42), dp(42)));
        }
        card.addView(header);
        TextView content = Design.text(this, activity.content == null ? "" : activity.content, activity.book == null ? 20 : 17, Design.textColor(dark), activity.book == null ? Typeface.ITALIC : Typeface.NORMAL);
        content.setPadding(0, dp(12), 0, dp(12));
        card.addView(content, matchWidthWrapHeight());
        if (activity.book != null) card.addView(bookMini(activity.book), matchWidthWrapHeight());
        LinearLayout actions = row(14);
        Button like = secondaryButton((activity.likedBy.contains(user.id) ? "♥ " : "♡ ") + activity.likes);
        like.setOnClickListener(v -> {
            if (guest) {
                showLoginPrompt();
                return;
            }
            boolean liked = activity.likedBy.contains(user.id);
            if (liked) {
                activity.likedBy.remove(user.id);
                activity.likes--;
            } else {
                activity.likedBy.add(user.id);
                activity.likes++;
            }
            async.run(() -> {
                repository.toggleActivityLike(activity.id, user.id);
                return null;
            }, new SimpleCallback<>(ignored -> renderCurrentTab()));
        });
        Button comments = secondaryButton("☰ " + activity.comments.size());
        comments.setOnClickListener(v -> showComments(activity));
        actions.addView(like, new LinearLayout.LayoutParams(0, dp(48), 1));
        actions.addView(comments, new LinearLayout.LayoutParams(0, dp(48), 1));
        card.addView(actions);
        return card;
    }

    private void showComments(ActivityPost activity) {
        LinearLayout view = column(12);
        view.setPadding(dp(18), dp(18), dp(18), dp(12));
        view.addView(Design.text(this, "Комментарии", 24, Design.textColor(dark), Typeface.BOLD));
        for (Comment comment : activity.comments) {
            LinearLayout row = row(10);
            ImageView avatar = image(dp(34), dp(34), 17);
            imageLoader.load(comment.userAvatar, avatar);
            row.addView(avatar);
            LinearLayout bubble = column(2);
            bubble.addView(Design.text(this, comment.userName, 12, Design.textColor(dark), Typeface.BOLD));
            bubble.addView(Design.text(this, comment.text, 14, Design.mutedText(dark), Typeface.NORMAL));
            row.addView(bubble, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            view.addView(row, matchWidthWrapHeight());
        }
        EditText input = input("Оставить комментарий...", false);
        view.addView(input, matchWidthWrapHeight());
        new AlertDialog.Builder(this)
                .setView(view)
                .setNegativeButton("Закрыть", null)
                .setPositiveButton("Отправить", (dialog, which) -> {
                    if (guest) {
                        showLoginPrompt();
                        return;
                    }
                    if (blank(input)) return;
                    Comment comment = new Comment();
                    comment.id = String.valueOf(System.currentTimeMillis());
                    comment.userId = user.id;
                    comment.userName = user.name;
                    comment.userAvatar = user.avatar;
                    comment.text = text(input);
                    comment.timestamp = "Только что";
                    async.run(() -> {
                        repository.addComment(activity.id, comment);
                        return null;
                    }, new SimpleCallback<>(ignored -> {
                        awardXp(5);
                        renderCurrentTab();
                    }));
                }).show();
    }

    private ScrollView boardPage() {
        LinearLayout page = pageColumn();
        LinearLayout header = isWide() ? row(16) : column(12);
        LinearLayout titles = column(4);
        titles.addView(Design.text(this, "The Grid", 50, Design.textColor(dark), Typeface.BOLD));
        titles.addView(Design.text(this, "Бесконечный поток коллективного разума.", 16, Design.mutedText(dark), Typeface.NORMAL));
        header.addView(titles, weightOrMatch());
        Button create = primaryButton("+  Создать тред");
        create.setOnClickListener(v -> showCreateThreadDialog());
        header.addView(create, isWide() ? lp(dp(190), dp(54)) : matchWidthWrapHeight());
        page.addView(header, matchWidthWrapHeight());
        LinearLayout list = column(14);
        list.addView(Design.text(this, "Синхронизация потоков...", 14, Design.STONE_400, Typeface.BOLD));
        page.addView(list, matchWidthWrapHeight());
        async.run(repository::getThreads, new ResultCallback<List<ThreadPost>>() {
            @Override
            public void onSuccess(List<ThreadPost> value) {
                threads.clear();
                threads.addAll(value);
                list.removeAllViews();
                if (value.isEmpty()) list.addView(Design.text(MainActivity.this, "Тредов пока нет.", 15, Design.STONE_400, Typeface.BOLD));
                for (ThreadPost thread : value) list.addView(threadCard(thread), matchWidthWrapHeight());
            }

            @Override
            public void onError(Exception error) {
                list.removeAllViews();
                list.addView(Design.text(MainActivity.this, error.getMessage(), 14, Design.ROSE, Typeface.BOLD));
            }
        });
        return scroll(page);
    }

    private LinearLayout threadCard(ThreadPost thread) {
        int border = thread.repliesCount > 50 ? Design.ROSE : thread.repliesCount > 20 ? Design.ORANGE : thread.repliesCount > 5 ? Design.AMBER : (dark ? Design.STONE_800 : Design.STONE_200);
        LinearLayout card = card(Design.cardBackground(dark), 28, 16);
        card.setBackground(Design.stroke(Design.cardBackground(dark), border, 28, 2, this));
        LinearLayout meta = row(10);
        TextView ident = Design.text(this, identiconLetter(thread.authorId), 18, Color.WHITE, Typeface.BOLD);
        ident.setGravity(Gravity.CENTER);
        ident.setBackground(Design.rounded(identiconColor(thread.authorId), 12, this));
        meta.addView(ident, lp(dp(38), dp(38)));
        LinearLayout author = column(2);
        author.addView(Design.text(this, thread.authorName, 11, Design.STONE_400, Typeface.BOLD));
        author.addView(Design.text(this, "ID: " + safe(thread.authorId).substring(0, Math.min(6, safe(thread.authorId).length())), 9, Design.STONE_300, Typeface.BOLD));
        meta.addView(author, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        meta.addView(Design.text(this, thread.timestamp, 9, Design.STONE_400, Typeface.BOLD));
        card.addView(meta);
        card.addView(Design.text(this, thread.title, 24, Design.textColor(dark), Typeface.BOLD));
        if (!blank(thread.imageUrl)) {
            ImageView image = image(ViewGroup.LayoutParams.MATCH_PARENT, dp(190), 16);
            imageLoader.load(thread.imageUrl, image);
            card.addView(image, matchWidthWrapHeight());
        }
        TextView preview = Design.text(this, thread.content, 15, Design.mutedText(dark), Typeface.NORMAL);
        preview.setMaxLines(4);
        preview.setEllipsize(TextUtils.TruncateAt.END);
        card.addView(preview);
        LinearLayout footer = row(12);
        footer.addView(Design.text(this, (thread.repliesCount > 20 ? "🔥 " : "☰ ") + thread.repliesCount, 13, Design.STONE_400, Typeface.BOLD), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        footer.addView(Design.text(this, "Открыть тред", 10, Design.STONE_400, Typeface.BOLD));
        card.addView(footer);
        card.setOnClickListener(v -> showThreadDialog(thread));
        return card;
    }

    private void showCreateThreadDialog() {
        if (guest) {
            showLoginPrompt();
            return;
        }
        pendingThreadImage = null;
        LinearLayout view = column(14);
        view.setPadding(dp(20), dp(18), dp(20), dp(14));
        view.addView(Design.text(this, "Новый тред", 26, Design.textColor(dark), Typeface.BOLD));
        EditText title = input("Тема обсуждения", false);
        EditText content = input("Разверните вашу мысль...", false);
        content.setMinLines(6);
        Button image = secondaryButton("Прикрепить обложку");
        image.setOnClickListener(v -> pickFile(REQ_THREAD_IMAGE, "image/*"));
        view.addView(title, matchWidthWrapHeight());
        view.addView(content, matchWidthWrapHeight());
        view.addView(image, matchWidthWrapHeight());
        new AlertDialog.Builder(this)
                .setView(view)
                .setNegativeButton("Отмена", null)
                .setPositiveButton("Запустить тред", (dialog, which) -> {
                    if (blank(title) || blank(content)) return;
                    async.run(() -> repository.createThread(text(title), text(content), pendingThreadImage, user.id, user.name), new SimpleCallback<>(created -> renderCurrentTab()));
                }).show();
    }

    private void showThreadDialog(ThreadPost thread) {
        pendingReplyImage = null;
        AlertDialog dialog = new AlertDialog.Builder(this).create();
        LinearLayout view = column(14);
        view.setPadding(dp(18), dp(18), dp(18), dp(10));
        view.addView(Design.text(this, thread.title, 28, Design.textColor(dark), Typeface.BOLD));
        view.addView(Design.text(this, "Создано " + thread.timestamp + " • " + thread.repliesCount + " ответов", 11, Design.STONE_400, Typeface.BOLD));
        if (!blank(thread.imageUrl)) {
            ImageView image = image(ViewGroup.LayoutParams.MATCH_PARENT, dp(220), 20);
            imageLoader.load(thread.imageUrl, image);
            view.addView(image, matchWidthWrapHeight());
        }
        view.addView(Design.text(this, thread.content, 17, Design.mutedText(dark), Typeface.ITALIC));
        EditText reply = input("Напишите ответ...", false);
        reply.setMinLines(3);
        Button attach = secondaryButton("Прикрепить изображение");
        attach.setOnClickListener(v -> pickFile(REQ_REPLY_IMAGE, "image/*"));
        Button send = primaryButton("Отправить");
        send.setOnClickListener(v -> {
            if (guest) {
                showLoginPrompt();
                return;
            }
            if (blank(reply)) return;
            async.run(() -> repository.postReply(thread.id, text(reply), pendingReplyImage, user.id, user.name), new SimpleCallback<>(created -> {
                dialog.dismiss();
                thread.repliesCount++;
                showThreadDialog(thread);
            }));
        });
        LinearLayout replies = column(12);
        replies.addView(Design.text(this, "Загрузка ответов...", 13, Design.STONE_400, Typeface.BOLD));
        view.addView(reply, matchWidthWrapHeight());
        view.addView(attach, matchWidthWrapHeight());
        view.addView(send, matchWidthWrapHeight());
        view.addView(replies, matchWidthWrapHeight());
        dialog.setView(scroll(view));
        dialog.show();
        async.run(() -> repository.getThreadReplies(thread.id), new ResultCallback<List<ThreadReply>>() {
            @Override
            public void onSuccess(List<ThreadReply> value) {
                replies.removeAllViews();
                if (value.isEmpty()) replies.addView(Design.text(MainActivity.this, "Нет ответов. Начните беседу.", 14, Design.STONE_400, Typeface.BOLD));
                for (ThreadReply item : value) replies.addView(replyCard(item), matchWidthWrapHeight());
            }

            @Override
            public void onError(Exception error) {
                replies.removeAllViews();
                replies.addView(Design.text(MainActivity.this, error.getMessage(), 13, Design.ROSE, Typeface.BOLD));
            }
        });
    }

    private LinearLayout replyCard(ThreadReply reply) {
        LinearLayout row = row(12);
        TextView avatar = Design.text(this, identiconLetter(reply.authorId), 15, Color.WHITE, Typeface.BOLD);
        avatar.setGravity(Gravity.CENTER);
        avatar.setBackground(Design.rounded(identiconColor(reply.authorId), 12, this));
        row.addView(avatar, lp(dp(40), dp(40)));
        LinearLayout bubble = card(dark ? Color.argb(40, 255, 255, 255) : Design.STONE_50, 20, 12);
        bubble.addView(Design.text(this, reply.authorName + " • " + reply.timestamp, 10, Design.AMBER, Typeface.BOLD));
        if (!blank(reply.imageUrl)) {
            ImageView image = image(ViewGroup.LayoutParams.MATCH_PARENT, dp(160), 12);
            imageLoader.load(reply.imageUrl, image);
            bubble.addView(image, matchWidthWrapHeight());
        }
        bubble.addView(Design.text(this, reply.content, 14, Design.mutedText(dark), Typeface.NORMAL));
        row.addView(bubble, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        return row;
    }

    private ScrollView oraclePage() {
        LinearLayout page = pageColumn();
        page.setGravity(Gravity.CENTER_HORIZONTAL);
        page.addView(Design.text(this, "Литературный Оракул", 42, Design.textColor(dark), Typeface.BOLD));
        page.addView(Design.text(this, "Интеллект Llama 3 на службе вашего чтения.", 16, Design.mutedText(dark), Typeface.NORMAL));
        if (!repository.hasGroqKey()) {
            LinearLayout missing = card(Design.cardBackground(dark), 28, 18);
            missing.addView(Design.text(this, "Groq Key Missing", 26, Design.textColor(dark), Typeface.BOLD));
            missing.addView(Design.text(this, "Для работы Оракула добавьте GROQ_API_KEY в app/src/main/res/values/strings.xml.", 15, Design.mutedText(dark), Typeface.NORMAL));
            page.addView(missing, matchWidthWrapHeight());
            return scroll(page);
        }
        LinearLayout ask = card(Design.cardBackground(dark), 24, 12);
        EditText prompt = input("Например: хочу что-то мрачное в стиле киберпанка...", false);
        prompt.setSingleLine(false);
        Button submit = primaryButton("Спросить");
        LinearLayout results = column(14);
        submit.setOnClickListener(v -> {
            if (blank(prompt)) return;
            results.removeAllViews();
            results.addView(Design.text(this, "Оракул думает...", 14, Design.STONE_400, Typeface.BOLD));
            async.run(() -> repository.getRecommendations(text(prompt), books), new ResultCallback<List<Recommendation>>() {
                @Override
                public void onSuccess(List<Recommendation> value) {
                    results.removeAllViews();
                    for (Recommendation rec : value) results.addView(recommendationCard(rec), matchWidthWrapHeight());
                }

                @Override
                public void onError(Exception error) {
                    results.removeAllViews();
                    results.addView(Design.text(MainActivity.this, error.getMessage(), 14, Design.ROSE, Typeface.BOLD));
                }
            });
        });
        ask.addView(prompt, matchWidthWrapHeight());
        ask.addView(submit, matchWidthWrapHeight());
        page.addView(ask, matchWidthWrapHeight());
        page.addView(results, matchWidthWrapHeight());
        return scroll(page);
    }

    private LinearLayout recommendationCard(Recommendation rec) {
        LinearLayout card = card(Design.cardBackground(dark), 30, 18);
        card.addView(Design.label(this, "Прозрение", dark));
        card.addView(Design.text(this, rec.title, 26, Design.textColor(dark), Typeface.BOLD));
        card.addView(Design.text(this, "от " + rec.author, 17, Design.mutedText(dark), Typeface.ITALIC));
        card.addView(Design.text(this, "~" + rec.pages + " стр.", 12, Design.STONE_400, Typeface.BOLD));
        TextView desc = Design.text(this, rec.vibe, 15, Design.STONE_400, Typeface.ITALIC);
        desc.setMaxLines(2);
        desc.setEllipsize(TextUtils.TruncateAt.END);
        card.addView(desc);
        card.setOnClickListener(v -> new AlertDialog.Builder(this)
                .setTitle(rec.title)
                .setMessage(rec.description)
                .setPositiveButton("Закрыть", null)
                .show());
        return card;
    }

    private ScrollView profilePage() {
        profileDraft = copyUser(user);
        LinearLayout page = pageColumn();
        FrameLayout banner = new FrameLayout(this);
        ImageView bannerImage = image(ViewGroup.LayoutParams.MATCH_PARENT, dp(210), 28);
        imageLoader.load(blank(user.bannerUrl) ? "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=2070&auto=format&fit=crop" : user.bannerUrl, bannerImage);
        banner.addView(bannerImage, match());
        ImageView avatar = image(dp(126), dp(126), 32);
        imageLoader.load(user.avatar, avatar);
        FrameLayout.LayoutParams avatarLp = new FrameLayout.LayoutParams(dp(126), dp(126), Gravity.BOTTOM | Gravity.START);
        avatarLp.setMargins(dp(24), 0, 0, -dp(36));
        banner.addView(avatar, avatarLp);
        page.addView(banner, lp(ViewGroup.LayoutParams.MATCH_PARENT, dp(250)));
        LinearLayout nameRow = row(12);
        LinearLayout text = column(4);
        text.addView(Design.text(this, user.name, 38, Design.textColor(dark), Typeface.BOLD));
        text.addView(Design.text(this, safe(user.handle) + " • " + (blank(user.location) ? "Где-то в книжном мире" : user.location), 11, Design.STONE_400, Typeface.BOLD));
        if (!blank(user.bio)) text.addView(Design.text(this, "«" + user.bio + "»", 16, Design.mutedText(dark), Typeface.NORMAL));
        nameRow.addView(text, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        if (!guest) {
            Button edit = smallButton("✎", false);
            edit.setOnClickListener(v -> showEditProfileDialog());
            nameRow.addView(edit, lp(dp(52), dp(52)));
        }
        page.addView(nameRow, matchWidthWrapHeight());

        LinearLayout stats = isWide() ? row(14) : column(14);
        int completed = 0;
        int totalPages = 0;
        int annotations = 0;
        for (Book b : books) {
            if (b.isCompleted()) completed++;
            totalPages += b.currentPage;
            annotations += b.annotations.size();
        }
        stats.addView(statCard("Текущая серия", user.streakDays + " Дней", "Непрерывного чтения", true), weightOrMatch());
        stats.addView(statCard("Прочитано", String.valueOf(completed), "Книг завершено", false), weightOrMatch());
        stats.addView(statCard("Страницы", String.valueOf(totalPages), "Всего страниц", false), weightOrMatch());
        page.addView(stats, matchWidthWrapHeight());

        page.addView(sectionTitle("Достижения"));
        page.addView(achievement("🐛", "Книжный червь", "Прочитать 5 книг", completed, 5), matchWidthWrapHeight());
        page.addView(achievement("🔥", "В ударе", "Серия чтения 7 дней", user.streakDays, 7), matchWidthWrapHeight());
        page.addView(achievement("🧠", "Мыслитель", "Создать 10 заметок", annotations, 10), matchWidthWrapHeight());
        page.addView(achievement("🏃", "Марафонец", "1 час чтения", user.totalReadingTime, 3600), matchWidthWrapHeight());
        return scroll(page);
    }

    private void showEditProfileDialog() {
        LinearLayout view = column(12);
        view.setPadding(dp(20), dp(18), dp(20), dp(14));
        EditText name = input("Имя", false);
        name.setText(user.name);
        EditText bio = input("О себе", false);
        bio.setText(user.bio);
        bio.setMinLines(3);
        EditText location = input("Локация", false);
        location.setText(user.location);
        Button avatar = secondaryButton("Изменить аватар");
        avatar.setOnClickListener(v -> pickFile(REQ_PROFILE_AVATAR, "image/*"));
        Button banner = secondaryButton("Изменить обложку");
        banner.setOnClickListener(v -> pickFile(REQ_PROFILE_BANNER, "image/*"));
        view.addView(Design.text(this, "Редактировать профиль", 24, Design.textColor(dark), Typeface.BOLD));
        view.addView(name, matchWidthWrapHeight());
        view.addView(bio, matchWidthWrapHeight());
        view.addView(location, matchWidthWrapHeight());
        view.addView(avatar, matchWidthWrapHeight());
        view.addView(banner, matchWidthWrapHeight());
        new AlertDialog.Builder(this)
                .setView(view)
                .setNegativeButton("Отмена", null)
                .setPositiveButton("Сохранить", (dialog, which) -> {
                    user.name = text(name);
                    user.bio = text(bio);
                    user.location = text(location);
                    if (profileDraft != null) {
                        if (!blank(profileDraft.avatar)) user.avatar = profileDraft.avatar;
                        if (!blank(profileDraft.bannerUrl)) user.bannerUrl = profileDraft.bannerUrl;
                    }
                    async.run(() -> {
                        repository.updateUserProfile(user);
                        return repository.loadUserData(user.id);
                    }, new SimpleCallback<>(session -> {
                        user = session.user;
                        books.clear();
                        books.addAll(session.books);
                        renderCurrentTab();
                    }));
                }).show();
    }

    private LinearLayout achievement(String icon, String title, String desc, int progress, int goal) {
        boolean unlocked = progress >= goal;
        LinearLayout card = row(16);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setBackground(Design.stroke(unlocked ? Design.cardBackground(dark) : (dark ? Color.argb(90, 28, 25, 23) : Color.argb(140, 245, 245, 244)), dark ? Design.STONE_800 : Design.STONE_100, 24, 1, this));
        TextView iconView = Design.text(this, unlocked ? icon : "🔒", 32, Design.textColor(dark), Typeface.BOLD);
        card.addView(iconView, lp(dp(54), dp(54)));
        LinearLayout copy = column(4);
        copy.addView(Design.text(this, title, 18, Design.textColor(dark), Typeface.BOLD));
        copy.addView(Design.text(this, desc + " • " + Math.min(progress, goal) + "/" + goal, 12, Design.mutedText(dark), Typeface.NORMAL));
        if (unlocked) copy.addView(Design.text(this, "Разблокировано", 10, Design.EMERALD, Typeface.BOLD));
        card.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        return card;
    }

    private void awardXp(int amount) {
        if (guest || user == null) return;
        user.xp += amount;
        if (user.xp >= 1000) {
            user.level += user.xp / 1000;
            user.xp %= 1000;
        }
        async.run(() -> {
            repository.addXp(user.id, amount);
            return null;
        }, new SimpleCallback<>(ignored -> {
        }));
    }

    private void logout() {
        if (guest) {
            showAuth(false);
            return;
        }
        showLoading("Выходим...");
        async.run(() -> {
            repository.logout();
            return null;
        }, new ResultCallback<Object>() {
            @Override
            public void onSuccess(Object value) {
                user = null;
                books.clear();
                activeTab = "home";
                showAuth(false);
            }

            @Override
            public void onError(Exception error) {
                user = null;
                books.clear();
                activeTab = "home";
                showAuth(false);
            }
        });
    }

    private void showLoginPrompt() {
        new AlertDialog.Builder(this)
                .setTitle("Join the Community")
                .setMessage("You need a B.Nook account to create posts, like, comment, and build your own library.")
                .setNegativeButton("Maybe Later", null)
                .setPositiveButton("Log In / Sign Up", (dialog, which) -> {
                    sessionStore.clearUserId();
                    showAuth(false);
                })
                .show();
    }

    private void setTheme(boolean nextDark) {
        dark = nextDark;
        sessionStore.saveDarkTheme(dark);
        showApp();
    }

    private void pickFile(int requestCode, String type) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(type);
        startActivityForResult(intent, requestCode);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        try {
            if (requestCode == REQ_BOOK_FILE && pendingBookContentInput != null) {
                pendingBookContentInput.setText(readBookFile(uri));
            } else if (requestCode == REQ_THREAD_IMAGE) {
                pendingThreadImage = dataUri(uri);
                toast("Изображение прикреплено");
            } else if (requestCode == REQ_REPLY_IMAGE) {
                pendingReplyImage = dataUri(uri);
                toast("Изображение прикреплено");
            } else if (requestCode == REQ_PROFILE_AVATAR) {
                if (profileDraft == null) profileDraft = copyUser(user);
                profileDraft.avatar = dataUri(uri);
                toast("Аватар выбран. Нажмите Сохранить.");
            } else if (requestCode == REQ_PROFILE_BANNER) {
                if (profileDraft == null) profileDraft = copyUser(user);
                profileDraft.bannerUrl = dataUri(uri);
                toast("Обложка выбрана. Нажмите Сохранить.");
            }
        } catch (Exception error) {
            toast(error.getMessage());
        }
    }

    private String readBookFile(Uri uri) throws Exception {
        String type = getContentResolver().getType(uri);
        String rawUri = String.valueOf(uri).toLowerCase(Locale.US);
        if ("application/pdf".equals(type) || rawUri.endsWith(".pdf")) {
            return readPdf(uri);
        }
        if ("application/epub+zip".equals(type) || rawUri.endsWith(".epub")) {
            return readEpub(uri);
        }
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) return "";
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private String readEpub(Uri uri) throws Exception {
        StringBuilder text = new StringBuilder();
        try (ZipInputStream zip = new ZipInputStream(getContentResolver().openInputStream(uri))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName().toLowerCase(Locale.US);
                if (name.endsWith(".html") || name.endsWith(".xhtml") || name.endsWith(".htm")) {
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    int read;
                    while ((read = zip.read(buffer)) != -1) output.write(buffer, 0, read);
                    String html = output.toString(StandardCharsets.UTF_8.name());
                    text.append(html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ")).append("\n\n");
                }
            }
        }
        if (text.length() < 50) throw new Exception("Не удалось извлечь текст из EPUB.");
        return text.toString();
    }

    private String readPdf(Uri uri) throws Exception {
        try (InputStream input = getContentResolver().openInputStream(uri);
             PDDocument document = PDDocument.load(input)) {
            String text = new PDFTextStripper().getText(document);
            if (text == null || text.trim().length() < 50) {
                throw new Exception("Текст не найден или PDF пуст.");
            }
            return text;
        }
    }

    private String dataUri(Uri uri) throws Exception {
        String mime = getContentResolver().getType(uri);
        if (mime == null) mime = "image/png";
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) return null;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return "data:" + mime + ";base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
        }
    }

    private LinearLayout card(int color, int radius, int padding) {
        LinearLayout card = column(12);
        card.setPadding(dp(padding), dp(padding), dp(padding), dp(padding));
        card.setBackground(Design.stroke(color, dark ? Design.STONE_800 : Design.STONE_100, radius, 1, this));
        card.setElevation(dp(4));
        Design.pressAnimation(card);
        return card;
    }

    private LinearLayout statCard(String label, String value, String desc, boolean darkCard) {
        LinearLayout card = card(darkCard ? Design.STONE_900 : Design.cardBackground(dark), 30, 20);
        card.addView(Design.label(this, label, darkCard || dark));
        card.addView(Design.text(this, value, 38, darkCard ? Color.WHITE : Design.textColor(dark), Typeface.BOLD));
        card.addView(Design.text(this, desc, 13, darkCard ? Color.argb(160, 255, 255, 255) : Design.mutedText(dark), Typeface.NORMAL));
        return card;
    }

    private LinearLayout bookMini(Book book) {
        LinearLayout row = row(12);
        row.setPadding(dp(10), dp(10), dp(10), dp(10));
        row.setBackground(Design.rounded(dark ? Design.STONE_800 : Design.STONE_50, 18, this));
        ImageView cover = image(dp(54), dp(80), 8);
        imageLoader.load(book.coverUrl, cover);
        row.addView(cover);
        LinearLayout copy = column(3);
        copy.addView(Design.text(this, book.title, 15, Design.textColor(dark), Typeface.BOLD));
        copy.addView(Design.text(this, "от " + book.author, 12, Design.mutedText(dark), Typeface.NORMAL));
        row.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        return row;
    }

    private LinearLayout activityMini(ActivityPost activity) {
        LinearLayout row = row(12);
        row.setPadding(dp(10), dp(10), dp(10), dp(10));
        row.setBackground(Design.rounded(dark ? Design.STONE_800 : Design.STONE_50, 18, this));
        ImageView avatar = image(dp(46), dp(46), 14);
        imageLoader.load(activity.user.avatar, avatar);
        row.addView(avatar);
        LinearLayout copy = column(2);
        copy.addView(Design.text(this, activity.user.name, 13, Design.textColor(dark), Typeface.BOLD));
        TextView snippet = Design.text(this, "«" + safe(activity.content) + "»", 12, Design.mutedText(dark), Typeface.ITALIC);
        snippet.setMaxLines(2);
        snippet.setEllipsize(TextUtils.TruncateAt.END);
        copy.addView(snippet);
        row.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        return row;
    }

    private LinearLayout leaderboardCard() {
        LinearLayout card = card(Design.cardBackground(dark), 28, 18);
        card.addView(sectionTitle("Лидеры"));
        for (int i = 0; i < leaderboard.size(); i++) {
            User leader = leaderboard.get(i);
            LinearLayout row = row(12);
            row.addView(Design.text(this, String.valueOf(i + 1), 14, i == 0 ? Design.AMBER : Design.STONE_400, Typeface.BOLD), lp(dp(22), dp(44)));
            ImageView avatar = image(dp(44), dp(44), 22);
            imageLoader.load(leader.avatar, avatar);
            row.addView(avatar);
            LinearLayout copy = column(2);
            copy.addView(Design.text(this, leader.name, 14, Design.textColor(dark), Typeface.BOLD));
            copy.addView(Design.text(this, leader.booksReadThisYear + " прочитано", 10, Design.STONE_400, Typeface.BOLD));
            row.addView(copy, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
            card.addView(row, matchWidthWrapHeight());
        }
        return card;
    }

    private TextView sectionTitle(String value) {
        return Design.text(this, value, 24, Design.textColor(dark), Typeface.BOLD);
    }

    private LinearLayout pageColumn() {
        LinearLayout page = column(18);
        int horizontal = isWide() ? 48 : 18;
        page.setPadding(dp(horizontal), dp(isWide() ? 42 : 22), dp(horizontal), dp(isWide() ? 42 : 120));
        return page;
    }

    private ScrollView scroll(View child) {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(false);
        scroll.addView(child, matchWidthWrapHeight());
        return scroll;
    }

    private LinearLayout column(int gapDp) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setShowDividers(LinearLayout.SHOW_DIVIDER_MIDDLE);
        layout.setDividerDrawable(new android.graphics.drawable.ColorDrawable(Color.TRANSPARENT) {
            @Override
            public int getIntrinsicHeight() {
                return dp(gapDp);
            }
        });
        return layout;
    }

    private LinearLayout row(int gapDp) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setShowDividers(LinearLayout.SHOW_DIVIDER_MIDDLE);
        layout.setDividerDrawable(new android.graphics.drawable.ColorDrawable(Color.TRANSPARENT) {
            @Override
            public int getIntrinsicWidth() {
                return dp(gapDp);
            }
        });
        return layout;
    }

    private EditText input(String hint, boolean password) {
        EditText input = new EditText(this);
        input.setHint(hint);
        input.setTextColor(Design.textColor(dark));
        input.setHintTextColor(Design.STONE_400);
        input.setTextSize(15);
        input.setSingleLine(!hint.contains("Текст") && !hint.contains("мысл") && !hint.contains("Комментар") && !hint.contains("Цитата") && !hint.contains("О себе"));
        input.setImeOptions(EditorInfo.IME_ACTION_DONE);
        input.setPadding(dp(16), dp(12), dp(16), dp(12));
        input.setBackground(Design.stroke(dark ? Design.STONE_950 : Design.STONE_50, dark ? Design.STONE_800 : Design.STONE_200, 14, 1, this));
        if (password) input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        return input;
    }

    private Button primaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextColor(dark ? Design.STONE_900 : Color.WHITE);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(Design.rounded(dark ? Color.WHITE : Design.STONE_900, 16, this));
        button.setPadding(dp(12), dp(8), dp(12), dp(8));
        Design.pressAnimation(button);
        return button;
    }

    private Button secondaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextColor(Design.mutedText(dark));
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackground(Design.stroke(dark ? Design.STONE_900 : Color.WHITE, dark ? Design.STONE_800 : Design.STONE_200, 16, 1, this));
        Design.pressAnimation(button);
        return button;
    }

    private Button smallButton(String text, boolean active) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(12);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextColor(active ? (dark ? Design.STONE_900 : Color.WHITE) : Design.STONE_400);
        button.setBackground(Design.rounded(active ? (dark ? Color.WHITE : Design.STONE_900) : (dark ? Design.STONE_800 : Design.STONE_100), 13, this));
        Design.pressAnimation(button);
        return button;
    }

    private ImageView image(int width, int height, int radius) {
        ImageView image = new ImageView(this);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setBackground(Design.rounded(dark ? Design.STONE_800 : Design.STONE_200, radius, this));
        image.setClipToOutline(true);
        image.setPadding(0, 0, 0, 0);
        return image;
    }

    private LinearLayout.LayoutParams weightOrMatch() {
        return isWide() ? new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1) : matchWidthWrapHeight();
    }

    private FrameLayout.LayoutParams bottomNavLp() {
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(76), Gravity.BOTTOM);
        params.setMargins(dp(18), 0, dp(18), dp(20));
        return params;
    }

    private FrameLayout.LayoutParams match() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private LinearLayout.LayoutParams matchWidthWrapHeight() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    private LinearLayout.LayoutParams lp(int width, int height) {
        return new LinearLayout.LayoutParams(width, height);
    }

    private int dp(float value) {
        return Design.dp(this, value);
    }

    private boolean isWide() {
        return getResources().getConfiguration().screenWidthDp >= 760
                || getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;
    }

    private String pageText(Book book) {
        String content = book.content == null || book.content.isEmpty() ? "Текст книги пока не добавлен..." : book.content;
        int start = Math.max(0, (book.currentPage - 1) * CHARS_PER_PAGE);
        int end = Math.min(content.length(), start + CHARS_PER_PAGE);
        return content.substring(start, end);
    }

    private String selectedText(TextView textView) {
        try {
            int start = textView.getSelectionStart();
            int end = textView.getSelectionEnd();
            if (start >= 0 && end > start) return textView.getText().subSequence(start, end).toString();
        } catch (Exception ignored) {
        }
        return "";
    }

    private int readerBg() {
        switch (sessionStore.getReaderTheme()) {
            case "sepia":
                return Color.rgb(244, 236, 216);
            case "night":
                return Design.STONE_950;
            case "solar":
                return Color.rgb(7, 54, 66);
            case "parchment":
            default:
                return Design.STONE_50;
        }
    }

    private int readerText() {
        switch (sessionStore.getReaderTheme()) {
            case "sepia":
                return Color.rgb(91, 70, 54);
            case "night":
                return Design.STONE_300;
            case "solar":
                return Color.rgb(147, 161, 161);
            case "parchment":
            default:
                return Design.STONE_900;
        }
    }

    private int readerMuted() {
        return Color.argb(150, Color.red(readerText()), Color.green(readerText()), Color.blue(readerText()));
    }

    private boolean canDelete(ActivityPost activity) {
        return !guest && (user.id.equals(activity.user.id) || BookNookRepository.ADMIN_EMAIL.equals(user.email) || BookNookRepository.ADMIN_EMAIL.equals(user.handle));
    }

    private String greeting() {
        int hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        if (hour < 5) return "Доброй ночи";
        if (hour < 12) return "Доброе утро";
        if (hour < 18) return "Добрый день";
        return "Добрый вечер";
    }

    private String firstName(String name) {
        if (name == null || name.trim().isEmpty()) return "";
        return name.trim().split("\\s+")[0];
    }

    private String statusLabel(String status) {
        if ("completed".equals(status)) return "Завершено";
        if ("reading".equals(status)) return "Читаю";
        return "В планах";
    }

    private String fallbackCover(String title) {
        return "https://ui-avatars.com/api/?name=" + Uri.encode(title == null ? "Book" : title) + "&background=random&size=512";
    }

    private User guestUser() {
        User guestUser = new User();
        guestUser.id = "guest";
        guestUser.name = "Гость";
        guestUser.handle = "@guest";
        guestUser.avatar = "https://ui-avatars.com/api/?name=G&background=b45309&color=fff";
        guestUser.bio = "Любитель книг и тихих вечеров.";
        guestUser.joinedDate = java.text.DateFormat.getDateInstance().format(new java.util.Date());
        guestUser.level = 1;
        return guestUser;
    }

    private User copyUser(User source) {
        User copy = new User();
        copy.id = source.id;
        copy.name = source.name;
        copy.email = source.email;
        copy.handle = source.handle;
        copy.avatar = source.avatar;
        copy.bannerUrl = source.bannerUrl;
        copy.bio = source.bio;
        copy.location = source.location;
        copy.joinedDate = source.joinedDate;
        copy.booksReadThisYear = source.booksReadThisYear;
        copy.totalBooksRead = source.totalBooksRead;
        copy.streakDays = source.streakDays;
        copy.totalReadingTime = source.totalReadingTime;
        copy.xp = source.xp;
        copy.level = source.level;
        return copy;
    }

    private int identiconColor(String seed) {
        int hash = Math.abs(safe(seed).hashCode());
        float[] hsv = new float[]{hash % 360, 0.58f, 0.64f};
        return Color.HSVToColor(hsv);
    }

    private String identiconLetter(String seed) {
        String safe = safe(seed);
        return safe.isEmpty() ? "?" : safe.substring(0, 1).toUpperCase(Locale.US);
    }

    private String text(EditText input) {
        return input.getText().toString().trim();
    }

    private boolean blank(EditText input) {
        return input == null || input.getText() == null || input.getText().toString().trim().isEmpty();
    }

    private boolean blank(String value) {
        return value == null || value.trim().isEmpty() || "null".equals(value);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private void confirm(String title, String message, Runnable yes) {
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message)
                .setNegativeButton("Отмена", null)
                .setPositiveButton("Удалить", (dialog, which) -> yes.run())
                .show();
    }

    private void toast(String value) {
        Toast.makeText(this, value == null ? "Ошибка" : value, Toast.LENGTH_LONG).show();
    }

    private class SimpleCallback<T> implements ResultCallback<T> {
        private final Success<T> success;

        SimpleCallback(Success<T> success) {
            this.success = success;
        }

        @Override
        public void onSuccess(T value) {
            success.run(value);
        }

        @Override
        public void onError(Exception error) {
            toast(error.getMessage());
        }
    }

    private interface Success<T> {
        void run(T value);
    }
}
