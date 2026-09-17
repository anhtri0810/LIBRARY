import schedule

import json

import time
import threading
import os
import shutil
import webbrowser
import urllib.parse

from datetime import datetime as dt

URL = "https://www.google.com/search?q={}"
FILE = "books.json"
DATA_FOLDER = "data"

stop = False

MENU = """\nENTER
'a' - add book
's' - show books
'q' - quit
'f' - find book
'd' - delete book
't' - tag book
'g' - get tagged
'o' - search book online
YOUR CHOICE: """


tags = {}

menu = {"a": "add book", "s": "show books", "f": "find book", "d": "delete_book", "t": "tag book",
        "g": "get tagged", "q": "quit"}


def delete_data_log():
	with open("log.txt", "w"):
		...


def run_scheduler():
	schedule.every(60).seconds.do(delete_data_log)
	schedule.every(5).seconds.do(create_copy)
	schedule.every(60).seconds.do(delete_data_folder)
	while not stop:
		schedule.run_pending()
		time.sleep(1)


def write_log(docs):
	with open("log.txt", "a") as f:
		for command, today in docs.items():
			desc = menu.get(command)
			f.write(f"{today}|{command}|{desc}\n")


def create_data():
	try:
		with open(FILE, 'x') as f:
			json.dump([], f)
	except FileExistsError:
		pass


def write_data(book_list):
	with open(FILE, 'w') as f:
		json.dump(book_list, f, indent=4)


def read_data():
	with open(FILE) as f:
		return json.load(f)


def add_book(books):
	title = input("Please enter the name of the book: ")
	author = input("Please enter the name of the author: ")
	year = int(input("Please enter the year when the book published: "))

	book = {
		"title": title,
		"author": author,
		"year": year,
		"tag": ""
	}

	books.append(book)
	write_data(books)
	print("Add book successfully")


def show_book(book, counter):
	print(f"\n{'=' * 10} Book {counter} {'=' * 10}")
	print(f"The title is: {book['title']}")
	print(f"The author is: {book['author']}")
	print(f"The year is: {book['year']}")

	if not book["tag"]:
		print("Hasn't tagged yet")
	else:
		print(f"The type of the book is: {book["tag"]}")


def show_books(books):
	if not books:
		print("No book!!")
	else:
		# list[dict(title, author, year)]
		new_books = sorted(books, key = lambda d: (d["title"].lower(), -d["year"]))
		for no, book in enumerate(new_books, start=1):
			show_book(book, no)


def find_book(books):
	keyword = input("Please enter the keyword of the book: ").lower()
	found = False
	counter = 1
	for book in books:
		if keyword in book["title"].lower():
			show_book(book, counter)
			counter += 1
			found = True

	if not found:
		print("We can't find the book!!")


def delete_book(books):
	deleted = []
	found = []
	keyword = input("Please enter the keyword of the book: ").lower()  # a|b|c .split('|') => [a, b, c]
	for i, book in enumerate(books):
		if keyword not in book['title'].lower():
			found.append(book)
		else:
			deleted.append(i)
	for tag in tags:
		new = []
		for i in tags[tag]:
			if i in deleted:
				continue
			cnt = 0
			for d in deleted:
				if d < i:
					cnt += 1
			new.append(i - cnt)
		tags[tag] = new
	if len(found) == len(books):
		print("We don't find any books")
	else:
		while True:
			question = input("\nDo you want to delete the book? (y - yes, n - no) ").lower()
			if question == "y":
				books[:] = found
				write_data(books)
				print("Delete book successfully")
				break
			elif question == "n":
				print("The list remains unchanged")
				break
			else:
				print("PLease enter the right choice")


def tag_book(books):
	index, cmd = input("> ").split()
	index = int(index) - 1
	if index < 0 or index >= len(books):
		print("Invalid")
	else:
		if books[index].get("tag") == cmd:
			print(f"Already has that book with {cmd}")
		else:
			books[index]["tag"] = cmd
			write_data(books)
			print(f"classify the book successfully with {cmd}")


def get_tagged(books):
    tag = input("Please enter the tag: ")
    counter = 1
    found = False
    for book in books:
        if book.get("tag") == tag:
            show_book(book, counter)
            counter += 1
            found = True
    if not found:
        print("Invalid")


def create_copy():
	os.makedirs(DATA_FOLDER, exist_ok=True)
	fname, ext = FILE.split('.')
	today = dt.now().strftime("%Y-%m-%d_%H-%M-%S")
	filename = f"{fname}_{today}.{ext}"
	backup_file = os.path.join(DATA_FOLDER, filename)
	shutil.copy(FILE, backup_file)


def delete_data_folder():
	shutil.rmtree(DATA_FOLDER)


def search_books_online():
	keyword = input("\nPlease enter the name of the book: ").strip()
	while not keyword:
		print("Please enter the name of the book: ")
		keyword = input("\nPlease enter the name of the book: ").strip()

	keyword = urllib.parse.quote(keyword)
	url = URL.format(keyword)
	webbrowser.open_new_tab(url)


def main():
	global stop
	threading.Thread(target=run_scheduler, daemon=True).start()
	history = {}
	create_data()
	books = read_data()
	while True:
		try:
			choice = input(MENU).lower()
			today = dt.now().strftime("%Y-%m-%d %H:%M:%S")
			history[choice] = today
			write_log(history)

			match choice:
				case "a":
					add_book(books)
				case "s":
					show_books(books)
				case "q":
					stop = True
					break
				case "f":
					find_book(books)
				case "d":
					delete_book(books)
				case "t":
					tag_book(books)
				case "g":
					get_tagged(books)
				case "o":
					search_books_online()
				case _:
					print("Please enter the right choice")
		except Exception as e:
			print(e)




main()
