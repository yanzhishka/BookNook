package com.booknook.converted.data;

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

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class BookNookRepository {
    public static final String ADMIN_EMAIL = "nme030609@gmail.com";

    private final JsonClient api;
    private final SessionStore store;
    private final String groqApiKey;

    public BookNookRepository(String apiBaseUrl, String groqApiKey, SessionStore store) {
        this.api = new JsonClient(apiBaseUrl);
        this.groqApiKey = groqApiKey == null ? "" : groqApiKey.trim();
        this.store = store;
    }

    // Native equivalent of db.getSession(): SharedPreferences replaces localStorage.
    public UserSession getSession() throws Exception {
        String userId = store.getUserId();
        if (userId == null || userId.trim().isEmpty()) return null;
        try {
            return loadUserData(userId);
        } catch (Exception error) {
            store.clearUserId();
            return null;
        }
    }

    public UserSession loadUserData(String userId) throws Exception {
        JSONObject data = api.getObject("/users/" + enc(userId) + "/data");
        UserSession session = new UserSession();
        JSONArray booksJson = data.optJSONArray("books");
        JSONArray quotesJson = data.optJSONArray("quotes");
        session.user = mapProfileToUser(data.optJSONObject("profile"));
        if (booksJson != null) {
            int completed = 0;
            for (int i = 0; i < booksJson.length(); i++) {
                Book book = mapDbBookToBook(booksJson.optJSONObject(i), quotesJson);
                if (book.isCompleted()) completed++;
                session.books.add(book);
            }
            session.user.booksReadThisYear = completed;
        }
        return session;
    }

    public UserSession login(String email, String password) throws Exception {
        JSONObject body = new JSONObject()
                .put("email", email)
                .put("password", password);
        JSONObject response = api.postObject("/auth/login", body);
        String userId = response.getString("userId");
        store.saveUserId(userId);
        return loadUserData(userId);
    }

    public User register(String email, String password, String name) throws Exception {
        JSONObject body = new JSONObject()
                .put("email", email)
                .put("password", password)
                .put("name", name);
        JSONObject response = api.postObject("/auth/register", body);
        String userId = response.optString("userId");
        if (!userId.isEmpty()) store.saveUserId(userId);
        return mapProfileToUser(response.optJSONObject("profile"));
    }

    public void logout() throws Exception {
        store.clearUserId();
        api.postObject("/auth/logout", new JSONObject());
    }

    public void updateUserProfile(User user) throws Exception {
        JSONObject body = new JSONObject()
                .put("name", user.name)
                .put("bio", user.bio)
                .put("location", user.location)
                .put("avatar", user.avatar)
                .put("banner_url", user.bannerUrl);
        api.patchObject("/profiles/" + enc(user.id), body);
    }

    public void addXp(String userId, int amount) throws Exception {
        JSONObject body = new JSONObject().put("userId", userId).put("amount", amount);
        api.postObject("/xp", body);
    }

    public List<ActivityPost> getFeed(int limit) throws Exception {
        JSONArray rows = api.getArray("/feed?limit=" + limit);
        List<ActivityPost> posts = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) {
            posts.add(mapActivity(rows.optJSONObject(i)));
        }
        return posts;
    }

    public ActivityPost createActivity(ActivityPost activity) throws Exception {
        JSONObject body = new JSONObject()
                .put("user_id", activity.user.id)
                .put("type", activity.type)
                .put("content", activity.content)
                .put("timestamp", activity.timestamp);
        if (activity.book != null) body.put("book_id", activity.book.id);
        JSONObject created = api.postObject("/activities", body);
        activity.id = created.optString("id", activity.id);
        activity.timestamp = formatDate(created.optString("created_at"));
        return activity;
    }

    public ActivityPost shareAnnotation(User user, Book book, Annotation annotation) throws Exception {
        ActivityPost activity = new ActivityPost();
        activity.user = user;
        activity.book = book;
        activity.type = "note";
        activity.content = annotation.quote + "\n\n- " + annotation.comment;
        activity.timestamp = "Только что";
        return createActivity(activity);
    }

    public void toggleActivityLike(String activityId, String userId) throws Exception {
        api.postObject("/activities/" + enc(activityId) + "/toggle-like", new JSONObject().put("userId", userId));
    }

    public void addComment(String activityId, Comment comment) throws Exception {
        JSONObject item = new JSONObject()
                .put("id", comment.id)
                .put("userId", comment.userId)
                .put("userName", comment.userName)
                .put("userAvatar", comment.userAvatar)
                .put("text", comment.text)
                .put("timestamp", comment.timestamp);
        api.postObject("/activities/" + enc(activityId) + "/comments", new JSONObject().put("comment", item));
    }

    public void deleteComment(String activityId, String commentId) throws Exception {
        api.delete("/activities/" + enc(activityId) + "/comments/" + enc(commentId));
    }

    public void deleteActivity(String id) throws Exception {
        api.delete("/activities/" + enc(id));
    }

    public List<User> getLeaderboard(int limit) throws Exception {
        JSONArray rows = api.getArray("/leaderboard?limit=" + limit);
        List<User> users = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject profile = rows.optJSONObject(i);
            User user = mapProfileToUser(profile);
            user.booksReadThisYear = profile.optInt("completed_count", user.booksReadThisYear);
            users.add(user);
        }
        return users;
    }

    public Book addBook(Book book, String userId) throws Exception {
        JSONObject body = new JSONObject()
                .put("user_id", userId)
                .put("title", book.title)
                .put("author", book.author)
                .put("cover_url", book.coverUrl)
                .put("progress", book.progress)
                .put("status", book.status)
                .put("my_rating", book.myRating)
                .put("is_lendable", book.isLendable)
                .put("content", book.content)
                .put("current_page", book.currentPage)
                .put("total_pages", book.totalPages);
        JSONObject created = api.postObject("/books", body);
        Book saved = mapDbBookToBook(created, new JSONArray());
        for (Annotation annotation : book.annotations) {
            saved.annotations.add(annotation);
        }
        if (!saved.annotations.isEmpty()) {
            syncAnnotations(saved.id, userId, saved.title, saved.annotations);
        }
        return saved;
    }

    public Book updateBook(Book book, String userId) throws Exception {
        JSONObject body = new JSONObject()
                .put("progress", book.progress)
                .put("status", book.status)
                .put("my_rating", book.myRating)
                .put("current_page", book.currentPage)
                .put("total_pages", book.totalPages);
        JSONObject updated = api.patchObject("/books/" + enc(book.id), body);
        Book saved = mapDbBookToBook(updated, new JSONArray());
        saved.annotations.addAll(book.annotations);
        if (!saved.annotations.isEmpty()) {
            syncAnnotations(saved.id, userId, saved.title, saved.annotations);
        }
        return saved;
    }

    public void deleteBook(String id) throws Exception {
        api.delete("/books/" + enc(id));
    }

    public void syncAnnotations(String bookId, String userId, String bookTitle, List<Annotation> annotations) throws Exception {
        for (Annotation annotation : annotations) {
            JSONObject body = new JSONObject()
                    .put("user_id", userId)
                    .put("book_id", bookId)
                    .put("book_title", bookTitle)
                    .put("text", annotation.quote)
                    .put("comment", annotation.comment)
                    .put("color", annotation.color)
                    .put("timestamp", annotation.timestamp);
            if (annotation.id != null && (annotation.id.contains("-") || annotation.id.length() > 20)) {
                body.put("id", annotation.id);
            }
            JSONObject saved = api.postObject("/quotes/upsert", body);
            annotation.id = saved.optString("id", annotation.id);
        }
    }

    public void deleteAnnotation(String annotationId) throws Exception {
        if (annotationId == null || annotationId.length() < 20) return;
        api.delete("/quotes/" + enc(annotationId));
    }

    public List<ThreadPost> getThreads() throws Exception {
        JSONArray rows = api.getArray("/threads");
        List<ThreadPost> threads = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) {
            threads.add(mapThread(rows.optJSONObject(i)));
        }
        return threads;
    }

    public ThreadPost createThread(String title, String content, String imageUrl, String userId, String userName) throws Exception {
        JSONObject body = new JSONObject()
                .put("title", title)
                .put("content", content)
                .put("image_url", imageUrl)
                .put("author_id", userId)
                .put("author_name", userName);
        ThreadPost thread = mapThread(api.postObject("/threads", body));
        thread.timestamp = "Только что";
        return thread;
    }

    public void deleteThread(String threadId) throws Exception {
        api.delete("/threads/" + enc(threadId));
    }

    public List<ThreadReply> getThreadReplies(String threadId) throws Exception {
        JSONArray rows = api.getArray("/threads/" + enc(threadId) + "/replies");
        List<ThreadReply> replies = new ArrayList<>();
        for (int i = rows.length() - 1; i >= 0; i--) {
            replies.add(mapThreadReply(rows.optJSONObject(i)));
        }
        return replies;
    }

    public ThreadReply postReply(String threadId, String content, String imageUrl, String userId, String userName) throws Exception {
        JSONObject body = new JSONObject()
                .put("content", content)
                .put("image_url", imageUrl)
                .put("author_id", userId)
                .put("author_name", userName);
        ThreadReply reply = mapThreadReply(api.postObject("/threads/" + enc(threadId) + "/replies", body));
        reply.timestamp = "Только что";
        return reply;
    }

    public void deleteThreadReply(String replyId) throws Exception {
        api.delete("/thread-replies/" + enc(replyId));
    }

    public List<BookLookupResult> searchBooks(String query) throws Exception {
        JSONArray rows = api.getArray("/open-library/search?query=" + enc(query));
        List<BookLookupResult> results = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject item = rows.optJSONObject(i);
            BookLookupResult result = new BookLookupResult();
            result.id = item.optString("id");
            result.title = item.optString("title", "Без названия");
            result.author = item.optString("author", "Автор не указан");
            result.coverUrl = item.optString("coverUrl");
            result.firstPublishYear = item.optInt("firstPublishYear");
            result.pageCount = item.optInt("pageCount");
            result.editionCount = item.optInt("editionCount");
            result.hasReadableText = item.optBoolean("hasReadableText");
            result.description = item.optString("description");
            JSONArray ia = item.optJSONArray("iaIds");
            if (ia != null) {
                for (int j = 0; j < ia.length(); j++) result.iaIds.add(ia.optString(j));
            }
            results.add(result);
        }
        return results;
    }

    public String fetchBookText(List<String> iaIds) throws Exception {
        int max = Math.min(3, iaIds.size());
        Exception last = null;
        for (int i = 0; i < max; i++) {
            try {
                JSONObject result = api.getObject("/open-library/text?iaId=" + enc(iaIds.get(i)));
                return result.optString("content");
            } catch (Exception error) {
                last = error;
            }
        }
        if (last != null) throw last;
        return null;
    }

    public boolean hasGroqKey() {
        return !groqApiKey.isEmpty();
    }

    public List<Recommendation> getRecommendations(String prompt, List<Book> books) throws Exception {
        if (groqApiKey.isEmpty()) throw new Exception("GROQ_API_KEY не настроен.");
        StringBuilder context = new StringBuilder();
        int count = Math.min(10, books.size());
        for (int i = 0; i < count; i++) {
            if (i > 0) context.append(", ");
            context.append(books.get(i).title);
        }

        JSONArray messages = new JSONArray()
                .put(new JSONObject()
                        .put("role", "system")
                        .put("content", "Ты — литературный Оракул. Твоя цель — подбирать книги на основе глубокого понимания атмосферы. Отвечай СТРОГО в формате JSON. Текст должен быть на русском языке. Структура: { \"recommendations\": [{ \"title\": \"\", \"author\": \"\", \"description\": \"(5-6 предложений)\", \"vibe\": \"(атмосфера)\", \"pages\": 300 }] }"))
                .put(new JSONObject()
                        .put("role", "user")
                        .put("content", "Рекомендуй 6 уникальных книг для: \"" + prompt + "\". Контекст пользователя (уже читал): " + context + "."));

        JSONObject body = new JSONObject()
                .put("model", "llama-3.3-70b-versatile")
                .put("messages", messages)
                .put("response_format", new JSONObject().put("type", "json_object"))
                .put("temperature", 0.7);

        JsonClient groq = new JsonClient("https://api.groq.com/openai/v1");
        Object raw = groqRequest(groq, body);
        JSONObject response = raw instanceof JSONObject ? (JSONObject) raw : new JSONObject();
        String content = response.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content");
        JSONObject parsed = new JSONObject(content);
        JSONArray rows = parsed.optJSONArray("recommendations");
        List<Recommendation> recs = new ArrayList<>();
        if (rows != null) {
            for (int i = 0; i < rows.length(); i++) {
                JSONObject item = rows.optJSONObject(i);
                Recommendation rec = new Recommendation();
                rec.title = item.optString("title");
                rec.author = item.optString("author");
                rec.description = item.optString("description");
                rec.vibe = item.optString("vibe");
                rec.pages = item.optInt("pages");
                recs.add(rec);
            }
        }
        return recs;
    }

    private Object groqRequest(JsonClient ignored, JSONObject body) throws Exception {
        java.net.URL url = new java.net.URL("https://api.groq.com/openai/v1/chat/completions");
        java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(18000);
        connection.setReadTimeout(45000);
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Authorization", "Bearer " + groqApiKey);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setDoOutput(true);
        try (java.io.BufferedWriter writer = new java.io.BufferedWriter(new java.io.OutputStreamWriter(connection.getOutputStream(), StandardCharsets.UTF_8))) {
            writer.write(body.toString());
        }
        int status = connection.getResponseCode();
        java.io.InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        String raw = readAll(stream);
        Object payload = raw.isEmpty() ? new JSONObject() : new org.json.JSONTokener(raw).nextValue();
        if (status < 200 || status >= 300) {
            String message = "Ошибка API Groq";
            if (payload instanceof JSONObject) {
                JSONObject error = ((JSONObject) payload).optJSONObject("error");
                if (error != null) message = error.optString("message", message);
            }
            throw new Exception(message);
        }
        return payload;
    }

    private User mapProfileToUser(JSONObject profile) {
        User user = new User();
        if (profile == null) return user;
        user.id = profile.optString("id");
        user.email = profile.optString("email");
        user.name = profile.optString("name", "User");
        String handle = profile.optString("handle");
        if (handle.isEmpty() && user.email != null && user.email.contains("@")) {
            handle = user.email.substring(0, user.email.indexOf("@"));
        }
        user.handle = handle.isEmpty() ? "user" : handle;
        user.avatar = profile.optString("avatar", "https://ui-avatars.com/api/?name=User&background=random");
        user.bannerUrl = profile.optString("banner_url");
        user.bio = profile.optString("bio");
        user.location = profile.optString("location");
        user.joinedDate = profile.optString("joined_date");
        user.booksReadThisYear = profile.optInt("booksReadThisYear", profile.optInt("completed_count", 0));
        user.streakDays = profile.optInt("streak_days");
        user.totalReadingTime = profile.optInt("total_reading_time");
        user.xp = profile.optInt("xp");
        user.level = profile.optInt("level", 1);
        return user;
    }

    private Book mapDbBookToBook(JSONObject json, JSONArray allQuotes) {
        Book book = new Book();
        if (json == null) return book;
        book.id = json.optString("id");
        book.title = json.optString("title");
        book.author = json.optString("author");
        book.coverUrl = json.optString("cover_url");
        book.progress = json.optInt("progress");
        book.status = json.optString("status", "want_to_read");
        book.myRating = json.optInt("my_rating");
        book.isLendable = json.optBoolean("is_lendable");
        book.content = json.optString("content");
        book.currentPage = Math.max(1, json.optInt("current_page", 1));
        book.totalPages = Math.max(1, json.optInt("total_pages", 1));
        if (allQuotes != null) {
            for (int i = 0; i < allQuotes.length(); i++) {
                JSONObject quote = allQuotes.optJSONObject(i);
                if (quote == null) continue;
                String bookId = quote.optString("book_id", quote.optString("bookId"));
                if (!book.id.equals(bookId)) continue;
                Annotation annotation = new Annotation();
                annotation.id = quote.optString("id");
                annotation.quote = quote.optString("text", quote.optString("quote"));
                annotation.comment = quote.optString("comment");
                annotation.color = quote.optString("color", "amber");
                annotation.timestamp = quote.optLong("timestamp", System.currentTimeMillis());
                book.annotations.add(annotation);
            }
        }
        return book;
    }

    private ActivityPost mapActivity(JSONObject item) {
        ActivityPost post = new ActivityPost();
        if (item == null) return post;
        post.id = item.optString("id");
        post.user = mapProfileToUser(item.optJSONObject("profile"));
        JSONObject bookJson = item.optJSONObject("book");
        post.book = bookJson == null ? null : mapDbBookToBook(bookJson, new JSONArray());
        post.type = item.optString("type");
        post.content = item.optString("content");
        post.timestamp = formatDate(item.optString("created_at"));
        JSONArray likedBy = item.optJSONArray("liked_by");
        if (likedBy != null) {
            post.likes = likedBy.length();
            for (int i = 0; i < likedBy.length(); i++) post.likedBy.add(likedBy.optString(i));
        }
        JSONArray comments = item.optJSONArray("comments");
        if (comments != null) {
            for (int i = 0; i < comments.length(); i++) {
                JSONObject c = comments.optJSONObject(i);
                if (c == null) continue;
                Comment comment = new Comment();
                comment.id = c.optString("id");
                comment.userId = c.optString("userId");
                comment.userName = c.optString("userName");
                comment.userAvatar = c.optString("userAvatar");
                comment.text = c.optString("text");
                comment.timestamp = c.optString("timestamp");
                post.comments.add(comment);
            }
        }
        return post;
    }

    private ThreadPost mapThread(JSONObject json) {
        ThreadPost thread = new ThreadPost();
        if (json == null) return thread;
        thread.id = json.optString("id");
        thread.title = json.optString("title");
        thread.authorId = json.optString("author_id");
        thread.authorName = json.optString("author_name");
        thread.content = json.optString("content");
        thread.imageUrl = json.optString("image_url");
        thread.repliesCount = json.optInt("replies_count");
        thread.timestamp = formatDateTime(json.optString("created_at"));
        return thread;
    }

    private ThreadReply mapThreadReply(JSONObject json) {
        ThreadReply reply = new ThreadReply();
        if (json == null) return reply;
        reply.id = json.optString("id");
        reply.threadId = json.optString("thread_id");
        reply.authorId = json.optString("author_id");
        reply.authorName = json.optString("author_name");
        reply.content = json.optString("content");
        reply.imageUrl = json.optString("image_url");
        reply.timestamp = formatTime(json.optString("created_at"));
        return reply;
    }

    private static String enc(String value) throws Exception {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8.name());
    }

    private static String formatDate(String raw) {
        return format(raw, "dd.MM.yyyy");
    }

    private static String formatDateTime(String raw) {
        return format(raw, "dd MMM HH:mm");
    }

    private static String formatTime(String raw) {
        return format(raw, "HH:mm");
    }

    private static String format(String raw, String pattern) {
        if (raw == null || raw.trim().isEmpty()) return "";
        try {
            String normalized = raw.replace("Z", "+0000");
            Date date = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US).parse(normalized);
            return new SimpleDateFormat(pattern, new Locale("ru", "RU")).format(date);
        } catch (Exception ignored) {
            return raw;
        }
    }

    private static String readAll(java.io.InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }
}
